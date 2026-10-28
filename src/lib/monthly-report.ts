import "server-only";

import { prisma } from "@/lib/prisma";
import { notifyChannels } from "@/lib/notify";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

/**
 * Monthly performance email — the renewal trigger.
 *
 * ROI is the argument that decides advertising budgets, and outbound clicks are
 * the only honest performance number this platform has. Putting it in front of
 * the brand once a month turns a one-off novelty purchase into a subscription
 * decision: it says what the money bought, and what holding the position costs
 * next month.
 *
 * Where there is nothing to report, nothing is sent. An email saying "you got 0
 * clicks" is worse than silence.
 */

const SPEND_TYPES = [
  "BRAND_ENTRY",
  "TOP_UP",
  "CELL_CLAIM",
  "CELL_UPKEEP",
  "CONTEST_BID",
] as const;

/** Do not email a brand about a month in which it did essentially nothing. */
const MIN_CLICKS_TO_REPORT = 3;

function plural(n: number, forms: [string, string, string]): string {
  const m100 = Math.abs(n) % 100;
  const m10 = m100 % 10;
  if (m100 >= 11 && m100 <= 14) return forms[2];
  if (m10 === 1) return forms[0];
  if (m10 >= 2 && m10 <= 4) return forms[1];
  return forms[2];
}

function kzt(n: number): string {
  return `${n.toLocaleString("ru-KZ")} ₸`;
}

function toStep(n: number): number {
  return Math.ceil(n / TERRITORY_CELL_PRICE_KZT) * TERRITORY_CELL_PRICE_KZT;
}

export type MonthlyReportResult = {
  considered: number;
  sent: number;
  skipped: number;
};

export async function sendMonthlyReports(
  now = new Date(),
): Promise<MonthlyReportResult> {
  const periodStart = new Date(now.getTime() - 30 * 86_400_000);

  const territories = await prisma.territory.findMany({
    where: { brand: { isActive: true } },
    select: {
      rank: true,
      cellCount: true,
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          primaryCategory: { select: { continentRu: true } },
          claims: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              contactEmail: true,
              submitter: { select: { email: true } },
            },
          },
        },
      },
      seasonCategory: { select: { id: true, categoryId: true } },
    },
    take: 500,
  });

  if (territories.length === 0) {
    return { considered: 0, sent: 0, skipped: 0 };
  }

  const brandIds = territories.map((t) => t.brand.id);

  const [clicksRows, spendRows, monthSpendRows] = await Promise.all([
    prisma.brandClick.groupBy({
      by: ["brandId"],
      where: { brandId: { in: brandIds }, createdAt: { gte: periodStart } },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["brandId"],
      where: {
        brandId: { in: brandIds },
        status: "COMPLETED",
        type: { in: [...SPEND_TYPES] },
      },
      _sum: { amountKzt: true },
    }),
    prisma.transaction.groupBy({
      by: ["brandId"],
      where: {
        brandId: { in: brandIds },
        status: "COMPLETED",
        type: { in: [...SPEND_TYPES] },
        createdAt: { gte: periodStart },
      },
      _sum: { amountKzt: true },
    }),
  ]);

  const clicksBy = new Map(clicksRows.map((r) => [r.brandId, r._count._all]));
  const spendBy = new Map(
    spendRows.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );
  const monthSpendBy = new Map(
    monthSpendRows.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );

  // The leader's spend per category, so we can quote what #1 currently costs.
  const leaderSpendByCategory = new Map<string, number>();
  for (const t of territories) {
    if (t.rank !== 1) continue;
    leaderSpendByCategory.set(
      t.seasonCategory.categoryId,
      spendBy.get(t.brand.id) ?? 0,
    );
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "https://brandwars.kz";
  let sent = 0;
  let skipped = 0;

  for (const territory of territories) {
    const brand = territory.brand;
    const clicks = clicksBy.get(brand.id) ?? 0;

    if (clicks < MIN_CLICKS_TO_REPORT) {
      skipped++;
      continue;
    }

    const email =
      brand.claims[0]?.contactEmail ?? brand.claims[0]?.submitter?.email ?? null;
    if (!email) {
      skipped++;
      continue;
    }

    const monthSpend = monthSpendBy.get(brand.id) ?? 0;
    const totalSpend = spendBy.get(brand.id) ?? 0;
    // Cost per click over the period, only when both sides are non-zero.
    const cpc = monthSpend > 0 && clicks > 0 ? Math.round(monthSpend / clicks) : null;

    const leaderSpend =
      leaderSpendByCategory.get(territory.seasonCategory.categoryId) ?? 0;
    const toFirstPlace =
      territory.rank === 1 ? null : toStep(Math.max(0, leaderSpend - totalSpend) + 1);

    const lines = [
      `Отчёт за 30 дней — «${brand.name}»`,
      ``,
      `Переходов по вашей ссылке: ${clicks}`,
      ...(monthSpend > 0 ? [`Вложено за период: ${kzt(monthSpend)}`] : []),
      ...(cpc !== null ? [`Стоимость перехода: ${kzt(cpc)}`] : []),
      ``,
      `Место в материке «${brand.primaryCategory.continentRu}»: #${territory.rank}`,
      `Территория: ${territory.cellCount} ${plural(territory.cellCount, ["клетка", "клетки", "клеток"])}`,
      ``,
      ...(territory.rank === 1
        ? [`Вы держите первое место. Чтобы не потерять клетки, поддерживайте территорию.`]
        : toFirstPlace !== null
          ? [`Чтобы выйти на первое место — доплата ${kzt(toFirstPlace)}.`]
          : []),
      ``,
      `Страница бренда: ${appUrl}/ru/brand/${brand.slug}`,
      `Кабинет: ${appUrl}/ru/dashboard`,
      ``,
      // Restating the rule keeps the email itself compliant.
      `Позиция определяется оплаченной суммой и площадью занятой земли — это игровая метрика платформы, а не оценка качества товаров или услуг.`,
    ];

    const text = lines.join("\n");

    await notifyChannels({
      toEmail: email,
      telegramChatId: null,
      subject: `«${brand.name}»: ${clicks} ${plural(clicks, ["переход", "перехода", "переходов"])} за 30 дней`,
      text,
      html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
    });

    sent++;
  }

  return { considered: territories.length, sent, skipped };
}
