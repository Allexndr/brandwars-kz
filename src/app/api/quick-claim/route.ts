import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkoutProviderSchema } from "@/lib/payments/methods";
import { prisma } from "@/lib/prisma";
import { normalizeWebsiteUrl } from "@/lib/normalize-url";
import { formatApiError } from "@/lib/format-api-error";
import { syncCategoryCatalog } from "@/lib/category-sync";
import { fetchUrlMetadata } from "@/lib/metadata-fetch";
import { suggestCategory, ENTRY_PRICE_KZT } from "@/lib/category-catalog";
import { getPaymentProvider } from "@/lib/payments/provider";
import { paymentStatusToken } from "@/lib/payments/status-token";
import { clientIpFrom, hashIdentifier } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * The short path: link, category, amount, pay. No account first.
 *
 * Requiring a magic-link sign-in *before* payment means leaving the site for an
 * inbox and coming back — the single most expensive step in the old flow. The
 * user record is created from the email given here, and the person signs in
 * afterwards to manage what they already bought.
 *
 * Cosmetics (character, outfit, city) deliberately live after payment.
 */
const schema = z.object({
  url: z.string().min(3).transform(normalizeWebsiteUrl).pipe(z.string().url()),
  categorySlug: z.string().min(1).optional(),
  contactEmail: z.string().email(),
  amountKzt: z.number().int().min(ENTRY_PRICE_KZT).multipleOf(500),
  brandName: z.string().min(1).max(120).optional(),
  phone: z.string().min(10).max(30),
  provider: checkoutProviderSchema.default("prodamus"),
});

/** Cheap abuse brake: unpaid claims per address per hour. */
const MAX_PENDING_PER_IP = 5;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatApiError(parsed.error.flatten(), "Проверьте ссылку и сумму") },
      { status: 400 },
    );
  }

  const data = parsed.data;
  await syncCategoryCatalog();

  const ip = clientIpFrom(request.headers);
  const ipHash = ip === "unknown" ? null : hashIdentifier(ip);

  if (ipHash) {
    const hourAgo = new Date(Date.now() - 3_600_000);
    const pending = await prisma.brandClaim.count({
      where: {
        status: "PENDING",
        paymentOrderId: null,
        createdAt: { gte: hourAgo },
        metadata: { path: ["ipHash"], equals: ipHash },
      },
    });
    if (pending >= MAX_PENDING_PER_IP) {
      return NextResponse.json(
        { error: "Слишком много неоплаченных заявок. Попробуйте позже." },
        { status: 429 },
      );
    }
  }

  // Pull the title/description/favicon so the listing reads like a real card
  // from the first second instead of a bare URL.
  const metadata = await fetchUrlMetadata(data.url).catch(() => null);

  const brandName =
    data.brandName?.trim() ||
    metadata?.title?.trim() ||
    new URL(data.url).hostname.replace(/^www\./, "");

  const categorySlug =
    data.categorySlug ??
    suggestCategory(`${data.url} ${metadata?.title ?? ""} ${metadata?.description ?? ""}`)
      .slug;

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    include: { seasonCategories: { where: { categoryId: category.id } } },
  });
  const seasonCategory = activeSeason?.seasonCategories[0];
  if (!seasonCategory) {
    return NextResponse.json(
      { error: "Сейчас нет активного сезона для этой категории" },
      { status: 400 },
    );
  }
  if (data.amountKzt < seasonCategory.entryMinimumKzt) {
    return NextResponse.json(
      {
        error: `Минимальная сумма — ${seasonCategory.entryMinimumKzt.toLocaleString("ru-KZ")} ₸`,
        minimumKzt: seasonCategory.entryMinimumKzt,
      },
      { status: 400 },
    );
  }

  // The email owner becomes the account holder. They have no session until they
  // request a magic link, so this cannot be used to take over an inbox.
  const email = data.contactEmail.toLowerCase().trim();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { id: true },
  });

  const claim = await prisma.brandClaim.create({
    data: {
      submittedById: user.id,
      websiteUrl: data.url,
      brandName,
      categoryId: category.id,
      contactEmail: email,
      bidAmountKzt: data.amountKzt,
      metadata: {
        title: metadata?.title ?? null,
        description: metadata?.description ?? null,
        favicon: metadata?.favicon ?? null,
        source: "quick_claim",
        ipHash,
      } as Prisma.InputJsonValue,
      moderation: { create: { status: "OPEN" } },
    },
    select: { id: true },
  });

  const idempotencyKey = `quick_${claim.id}`;

  try {
    const provider =
      process.env.PAYMENT_TEST_MODE === "true"
        ? getPaymentProvider("test")
        : getPaymentProvider(data.provider);
    const order = await provider.createOrder({
      amountKzt: data.amountKzt,
      userId: user.id,
      idempotencyKey,
      metadata: { claimId: claim.id },
      phone: data.phone,
      email,
      name: brandName,
      description: `Размещение «${brandName}» на BrandWars.kz`,
      ip,
    });

    const paymentOrder = await prisma.paymentOrder.create({
      data: {
        userId: user.id,
        amountKzt: data.amountKzt,
        status: "PENDING",
        paymentProvider: provider.name,
        providerOrderId: order.providerOrderId,
        checkoutUrl: order.paymentUrl,
        idempotencyKey,
        metadata: { claimId: claim.id } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await prisma.brandClaim.update({
      where: { id: claim.id },
      data: { paymentOrderId: paymentOrder.id },
    });

    return NextResponse.json(
      {
        claimId: claim.id,
        orderId: paymentOrder.id,
        statusToken: paymentStatusToken(paymentOrder.id),
        brandName,
        categorySlug: category.slug,
        categoryNameRu: category.nameRu,
        continentRu: category.continentRu,
        amountKzt: data.amountKzt,
        paymentUrl: order.paymentUrl,
        paymentMode: order.mode,
        paymentMessage: order.message,
        provider: provider.name,
        testMode:
          provider.name === "test" || process.env.PAYMENT_TEST_MODE === "true",
      },
      { status: 201 },
    );
  } catch (error) {
    // Do not strand an unpayable claim in the moderation queue.
    await prisma.brandClaim
      .delete({ where: { id: claim.id } })
      .catch(() => undefined);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось создать платёж",
      },
      { status: 502 },
    );
  }
}
