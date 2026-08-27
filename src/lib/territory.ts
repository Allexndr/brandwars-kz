import { prisma } from "@/lib/prisma";

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

export async function recalculateCategory(seasonCategoryId: string): Promise<void> {
  const territories = await prisma.territory.findMany({
    where: { seasonCategoryId },
    select: { id: true, brandId: true },
  });

  const battlePowers = await Promise.all(
    territories.map(async (t) => ({
      brandId: t.brandId,
      battlePower: await computeBrandBattlePower(t.brandId),
    })),
  );

  battlePowers.sort((a, b) => b.battlePower - a.battlePower);

  const shares = computeTerritoryShares(battlePowers);
  const total = battlePowers.length;

  await Promise.all(
    battlePowers.map((item, index) => {
      const rank = index + 1;
      return prisma.territory.updateMany({
        where: { seasonCategoryId, brandId: item.brandId },
        data: {
          battlePower: item.battlePower,
          territoryShare: shares.get(item.brandId) ?? 0,
          rank,
          visualLevel: computeVisualLevel(rank, total),
          capitalLevel: computeCapitalLevel(rank),
        },
      });
    }),
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
