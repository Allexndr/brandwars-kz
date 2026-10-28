import { prisma } from "@/lib/prisma";
import { notifyChannels } from "@/lib/notify";
import { getPaymentProvider } from "@/lib/payments/provider";

export function computeVisualLevel(rank: number, total: number): number {
  if (rank === 1) return 5;
  if (rank <= 3) return 4;
  if (rank <= 10) return 3;
  return 1;
}

export function computeCapitalLevel(rank: number): number {
  if (rank === 1) return 5;
  if (rank <= 3) return 4;
  if (rank <= 10) return 3;
  return 1;
}

export function computeTerritoryShares(
  battlePowers: { brandId: string; battlePower: number }[],
): Map<string, number> {
  const sqrtSum = battlePowers.reduce(
    (sum, item) => sum + Math.sqrt(Math.max(0, item.battlePower)),
    0,
  );

  const shares = new Map<string, number>();

  if (sqrtSum === 0) {
    const equal = battlePowers.length > 0 ? 1 / battlePowers.length : 0;
    for (const item of battlePowers) {
      shares.set(item.brandId, equal);
    }
    return shares;
  }

  for (const item of battlePowers) {
    const share = Math.sqrt(Math.max(0, item.battlePower)) / sqrtSum;
    shares.set(item.brandId, share);
  }

  return shares;
}

export async function computeBrandBattlePower(brandId: string): Promise<number> {
  const [paidTransactions, supportActions] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        brandId,
        status: "COMPLETED",
        type: { in: ["BRAND_ENTRY", "TOP_UP"] },
      },
      _sum: { amountKzt: true },
    }),
    prisma.communitySupportAction.aggregate({
      where: { brandId },
      _sum: { power: true },
    }),
  ]);

  const spend = paidTransactions._sum.amountKzt ?? 0;
  const support = supportActions._sum.power ?? 0;

  return spend + support * 10;
}

/** KZT needed to surpass rival battle power by 1 */
export function amountToOvertake(myPower: number, rivalPower: number): number {
  const gap = rivalPower - myPower + 1;
  return Math.max(500, Math.ceil(gap));
}

async function buildOvertakePayUrl(params: {
  userId: string;
  brandId: string;
  amountKzt: number;
}): Promise<string> {
  const appUrl = process.env.NEXTAUTH_URL ?? "https://brand-wars.vercel.app";
  const fallback = `${appUrl}/ru/dashboard?topUp=${params.amountKzt}&brandId=${params.brandId}`;

  try {
    const provider = getPaymentProvider();
    if (provider.name === "test") return fallback;

    const idempotencyKey = `overtake_${params.brandId}_${params.amountKzt}_${Date.now()}`;
    const result = await provider.createOrder({
      amountKzt: params.amountKzt,
      userId: params.userId,
      brandId: params.brandId,
      idempotencyKey,
      metadata: { reason: "overtake" },
    });

    await prisma.paymentOrder.create({
      data: {
        userId: params.userId,
        brandId: params.brandId,
        amountKzt: params.amountKzt,
        status: "PENDING",
        paymentProvider: provider.name,
        providerOrderId: result.providerOrderId,
        idempotencyKey,
      },
    });

    return result.paymentUrl ?? fallback;
  } catch {
    return fallback;
  }
}

async function notifyOvertakes(
  seasonCategoryId: string,
  before: Map<string, number>,
  after: { brandId: string; battlePower: number; rank: number }[],
): Promise<void> {
  const afterById = new Map(after.map((a) => [a.brandId, a]));

  for (const [brandId, oldRank] of before) {
    const now = afterById.get(brandId);
    if (!now) continue;
    // rank 1 is best — higher number means dropped
    if (now.rank <= oldRank) continue;

    // Dropped in rank → someone overtook
    const rival = after.find((a) => a.rank === now.rank - 1) ?? after[0];
    if (!rival || rival.brandId === brandId) continue;

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        claims: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { submitter: true },
        },
      },
    });
    if (!brand) continue;

    const rivalBrand = await prisma.brand.findUnique({ where: { id: rival.brandId } });
    const amount = amountToOvertake(now.battlePower, rival.battlePower);
    const ownerId = brand.ownerUserId ?? brand.claims[0]?.submittedById;
    const email =
      brand.claims[0]?.contactEmail ?? brand.claims[0]?.submitter?.email ?? null;

    if (!ownerId) continue;

    const payUrl = await buildOvertakePayUrl({
      userId: ownerId,
      brandId,
      amountKzt: amount,
    });

    const subject = `Вас обошли на BrandWars: ${rivalBrand?.name ?? "соперник"} выше`;
    const text = [
      `Бренд «${brand.name}» опустился с #${oldRank} на #${now.rank}.`,
      `Сейчас выше: «${rivalBrand?.name ?? "соперник"}» (сила ${Math.round(rival.battlePower)}).`,
      `Чтобы обойти — доплата ${amount.toLocaleString("ru-KZ")} ₸ (разница +1).`,
      ``,
      `Быстрая оплата (карта / Google Pay):`,
      payUrl,
      ``,
      `BrandWars.kz — игровая метрика, не «лучший бренд».`,
    ].join("\n");

    await notifyChannels({
      toEmail: email,
      telegramChatId: null,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, "<br/>")}</p><p><a href="${payUrl}">Оплатить ${amount.toLocaleString("ru-KZ")} ₸ и обойти</a></p>`,
    });
  }
}

export async function recalculateCategory(seasonCategoryId: string): Promise<void> {
  const territories = await prisma.territory.findMany({
    where: { seasonCategoryId },
    select: { id: true, brandId: true, rank: true },
  });

  const before = new Map(territories.map((t) => [t.brandId, t.rank]));

  const battlePowers = await Promise.all(
    territories.map(async (t) => ({
      brandId: t.brandId,
      battlePower: await computeBrandBattlePower(t.brandId),
    })),
  );

  battlePowers.sort((a, b) => b.battlePower - a.battlePower);

  const shares = computeTerritoryShares(battlePowers);
  const total = battlePowers.length;

  const after = battlePowers.map((item, index) => ({
    brandId: item.brandId,
    battlePower: item.battlePower,
    rank: index + 1,
  }));

  await Promise.all(
    after.map((item) =>
      prisma.territory.updateMany({
        where: { seasonCategoryId, brandId: item.brandId },
        data: {
          battlePower: item.battlePower,
          territoryShare: shares.get(item.brandId) ?? 0,
          rank: item.rank,
          visualLevel: computeVisualLevel(item.rank, total),
          capitalLevel: computeCapitalLevel(item.rank),
        },
      }),
    ),
  );

  // Fire-and-forget notifications
  void notifyOvertakes(seasonCategoryId, before, after).catch((err) =>
    console.error("[overtake-notify]", err),
  );
}

export async function recalculateBrandTerritory(
  brandId: string,
  seasonCategoryId: string,
): Promise<void> {
  await recalculateCategory(seasonCategoryId);
}

export function getRankLabel(rank: number, locale: string): string {
  if (rank === 1) {
    return locale === "kk" ? "Санат лидері" : "Лидер BrandWars в категории";
  }
  if (rank <= 3) {
    return locale === "kk" ? "Үлкен держава" : "Великая держава";
  }
  if (rank <= 10) {
    return locale === "kk" ? "Үміткер" : "Претендент";
  }
  return locale === "kk" ? "Жаңадан келген" : "Новичок";
}
