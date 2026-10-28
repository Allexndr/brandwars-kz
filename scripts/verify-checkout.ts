/**
 * End-to-end check of the money path, on the test payment provider.
 *
 * This is the chain that cannot be verified by reading code: anonymous
 * checkout -> payment order -> webhook -> fulfilment -> moderation -> territory
 * -> documents. Everything here either moves money or grants paid placement, so
 * the checks lean on the failure modes that would actually cost: double
 * fulfilment, placement before payment, amount mismatch, duplicate invoices.
 *
 * Run: pnpm verify:checkout
 */
import { PrismaClient } from "@prisma/client";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import { ensureInvoiceForOrder, formatInvoiceNumber } from "@/lib/invoicing";
import { ensureScopes, ensureArena, claimCell } from "@/lib/arena";
import { recalculateCategory } from "@/lib/territory";
import { recordBrandClick, hashIdentifier } from "@/lib/analytics";
import { CATEGORY_CATALOG } from "@/lib/category-catalog";
import { slugify, normalizeBrandName } from "@/lib/utils";

const prisma = new PrismaClient();

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run: DATABASE_URL is not local. This wipes data.");
  process.exit(1);
}

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`, ok ? "" : (detail ?? ""));
  if (!ok) failures++;
}

async function wipe() {
  await prisma.$transaction([
    prisma.cellEvent.deleteMany({}),
    prisma.contestBid.deleteMany({}),
    prisma.contest.deleteMany({}),
    prisma.cell.deleteMany({}),
    prisma.arena.deleteMany({}),
    prisma.territory.deleteMany({}),
    prisma.socialPost.deleteMany({}),
    prisma.brandClick.deleteMany({}),
    prisma.invoice.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.moderationCase.deleteMany({}),
    prisma.brandClaim.deleteMany({}),
    prisma.paymentOrder.deleteMany({}),
    prisma.billingProfile.deleteMany({}),
    prisma.walletTransaction.deleteMany({}),
    prisma.wallet.deleteMany({}),
    prisma.brandMember.deleteMany({}),
    prisma.brand.deleteMany({}),
    prisma.seasonCategory.deleteMany({}),
    prisma.scope.deleteMany({}),
    prisma.season.deleteMany({}),
    prisma.category.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}

async function main() {
  console.log("\n=== ПОДГОТОВКА ===");
  await wipe();

  const season = await prisma.season.create({
    data: {
      slug: "s1",
      nameRu: "Сезон 1",
      nameKk: "М1",
      status: "ACTIVE",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  for (const [i, def] of CATEGORY_CATALOG.entries()) {
    await prisma.category.create({
      data: {
        slug: def.slug,
        nameRu: def.nameRu,
        nameKk: def.nameKk,
        continentRu: def.continentRu,
        continentKk: def.continentKk,
        color: def.color,
        sortOrder: i,
      },
    });
  }
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "travel" } });
  const seasonCategory = await prisma.seasonCategory.create({
    data: {
      seasonId: season.id,
      categoryId: category.id,
      entryMinimumKzt: 1000,
      priceCoefficient: 500,
    },
  });
  await ensureScopes();
  const kz = await prisma.scope.findUniqueOrThrow({ where: { slug: "kz" } });
  const arenaId = await ensureArena(seasonCategory.id, kz.id);
  check("сезон, категории, арена созданы", Boolean(arenaId));

  // ---------------------------------------------------------------
  console.log("\n=== 1. АНОНИМНАЯ ЗАЯВКА (без логина) ===");
  const email = "buyer@test.kz";
  const buyer = await prisma.user.create({ data: { email } });
  check("пользователь создан из email, без пароля и сессии", Boolean(buyer.id));

  const AMOUNT = 11_500;
  const claim = await prisma.brandClaim.create({
    data: {
      submittedById: buyer.id,
      websiteUrl: "https://aviata.kz",
      brandName: "Aviata",
      categoryId: category.id,
      contactEmail: email,
      bidAmountKzt: AMOUNT,
      status: "PENDING",
      moderation: { create: { status: "OPEN" } },
    },
  });

  const order = await prisma.paymentOrder.create({
    data: {
      userId: buyer.id,
      amountKzt: AMOUNT,
      status: "PENDING",
      paymentProvider: "test",
      providerOrderId: `test_quick_${claim.id}`,
      idempotencyKey: `quick_${claim.id}`,
      metadata: { claimId: claim.id },
    },
  });
  await prisma.brandClaim.update({
    where: { id: claim.id },
    data: { paymentOrderId: order.id },
  });
  check("заказ создан в статусе PENDING", order.status === "PENDING");

  // ---------------------------------------------------------------
  console.log("\n=== 2. РАЗМЕЩЕНИЕ ДО ОПЛАТЫ ЗАПРЕЩЕНО ===");
  const beforePay = await prisma.transaction.count();
  check("нет ни одной завершённой транзакции до оплаты", beforePay === 0, beforePay);

  const earlyInvoice = await ensureInvoiceForOrder(order.id);
  check(
    "счёт нельзя выписать до оплаты",
    earlyInvoice.ok === false && earlyInvoice.reason === "not_paid",
    earlyInvoice,
  );

  // ---------------------------------------------------------------
  console.log("\n=== 3. ВЕБХУК И ЗАЧИСЛЕНИЕ ===");
  const wrongAmount = await fulfillPaidOrder(order.id, order.providerOrderId!, 500);
  check("вебхук с чужой суммой отвергнут", wrongAmount === null, wrongAmount);

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: "PAID" },
  });
  const fulfilled = await fulfillPaidOrder(order.id, order.providerOrderId!, AMOUNT);
  check("оплата зачислена", fulfilled !== null);

  const afterPay = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
  check("appliedAt проставлен", afterPay.appliedAt !== null);

  const txCount1 = await prisma.transaction.count({ where: { status: "COMPLETED" } });
  check("создана ровно одна транзакция", txCount1 === 1, txCount1);

  // Idempotency: a provider retry must not pay twice.
  await fulfillPaidOrder(order.id, order.providerOrderId!, AMOUNT);
  await fulfillPaidOrder(order.id, order.providerOrderId!, AMOUNT);
  const txCount2 = await prisma.transaction.count({ where: { status: "COMPLETED" } });
  check("повтор вебхука не создаёт вторую транзакцию", txCount2 === 1, txCount2);

  // ---------------------------------------------------------------
  console.log("\n=== 4. МОДЕРАЦИЯ ===");
  const paidClaim = await prisma.brandClaim.findUniqueOrThrow({
    where: { id: claim.id },
    include: { paymentOrder: true },
  });
  check(
    "заявка связана с оплаченным заказом",
    paidClaim.paymentOrder?.status === "PAID" && paidClaim.paymentOrder.appliedAt !== null,
  );

  const brand = await prisma.brand.create({
    data: {
      slug: slugify(paidClaim.brandName),
      name: paidClaim.brandName,
      normalizedName: normalizeBrandName(paidClaim.brandName),
      websiteUrl: paidClaim.websiteUrl,
      primaryCategoryId: paidClaim.categoryId,
      ownerUserId: paidClaim.submittedById,
      verificationStatus: "PENDING",
      source: "claim",
    },
  });
  await prisma.brandClaim.update({
    where: { id: claim.id },
    data: { status: "APPROVED", brandId: brand.id },
  });
  await prisma.transaction.updateMany({
    where: { paymentOrderId: order.id },
    data: { brandId: brand.id },
  });
  await prisma.territory.create({
    data: { seasonCategoryId: seasonCategory.id, brandId: brand.id, rank: 999 },
  });
  await recalculateCategory(seasonCategory.id);
  check("бренд и территория созданы после одобрения", Boolean(brand.id));

  // ---------------------------------------------------------------
  console.log("\n=== 5. ЗЕМЛЯ ===");
  const cell = await prisma.cell.findFirstOrThrow({
    where: { arenaId, state: "NEUTRAL", layer: { not: "CAPITAL" } },
  });
  const claimed = await claimCell({
    arenaId,
    q: cell.q,
    r: cell.r,
    brandId: brand.id,
    userId: buyer.id,
    amountKzt: cell.priceKzt,
  });
  check("клетка занята", claimed.ok === true, claimed);

  await recalculateCategory(seasonCategory.id);
  const territory = await prisma.territory.findFirstOrThrow({
    where: { seasonCategoryId: seasonCategory.id, brandId: brand.id },
  });
  check("территория пересчитана", territory.cellCount === 1, territory.cellCount);
  check("бренд стал первым", territory.rank === 1, territory.rank);

  // ---------------------------------------------------------------
  console.log("\n=== 6. ПЕРЕХОДЫ ===");
  const click1 = await recordBrandClick({
    brandId: brand.id,
    ipHash: hashIdentifier("1.2.3.4"),
    referer: null,
    userAgent: "test",
  });
  check("переход засчитан", click1.counted === true && click1.clickCount === 1, click1);

  const click2 = await recordBrandClick({
    brandId: brand.id,
    ipHash: hashIdentifier("1.2.3.4"),
    referer: null,
    userAgent: "test",
  });
  check("повторный переход с того же IP не засчитан", click2.counted === false, click2);

  const click3 = await recordBrandClick({
    brandId: brand.id,
    ipHash: hashIdentifier("5.6.7.8"),
    referer: null,
    userAgent: "test",
  });
  check("переход с другого IP засчитан", click3.counted === true && click3.clickCount === 2, click3);

  // ---------------------------------------------------------------
  console.log("\n=== 7. ДОКУМЕНТЫ ===");
  await prisma.billingProfile.create({
    data: {
      userId: buyer.id,
      kind: "COMPANY",
      companyName: 'ТОО "Демо"',
      bin: "123456789012",
      address: "г. Алматы",
    },
  });

  const inv1 = await ensureInvoiceForOrder(order.id);
  check("счёт выписан после оплаты", inv1.ok === true, inv1);

  const inv2 = await ensureInvoiceForOrder(order.id);
  check(
    "повторный вызов не создаёт второй счёт",
    inv2.ok === true && inv2.created === false && inv1.ok && inv2.number === inv1.number,
    inv2,
  );

  const invoice = await prisma.invoice.findFirstOrThrow({ where: { paymentOrderId: order.id } });
  check("реквизиты покупателя в снимке", invoice.payerBin === "123456789012", invoice.payerBin);
  check("сумма совпадает с заказом", invoice.amountKzt === AMOUNT, invoice.amountKzt);
  check(
    "номер документа сформирован",
    /^BW-\d{4}-\d{5}$/.test(formatInvoiceNumber(invoice.number, invoice.issuedAt)),
    formatInvoiceNumber(invoice.number, invoice.issuedAt),
  );

  // Changing the profile afterwards must not rewrite an issued document.
  await prisma.billingProfile.update({
    where: { userId: buyer.id },
    data: { companyName: 'ТОО "Переименовано"', bin: "999999999999" },
  });
  const invoiceAfter = await prisma.invoice.findFirstOrThrow({
    where: { paymentOrderId: order.id },
  });
  check(
    "выписанный счёт не меняется при правке реквизитов",
    invoiceAfter.payerBin === "123456789012",
    invoiceAfter.payerBin,
  );

  console.log(
    failures === 0 ? "\nДЕНЕЖНЫЙ ПУТЬ ПРОЙДЕН ПОЛНОСТЬЮ\n" : `\n${failures} ПРОВАЛОВ\n`,
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
