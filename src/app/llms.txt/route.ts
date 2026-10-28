import { NextResponse } from "next/server";
import { buildPlatformReport, reportDate } from "@/lib/report-data";

export const dynamic = "force-dynamic";

/**
 * llms.txt — a plain-text map of the site for language models.
 *
 * Serving live figures here rather than a static blurb is the point: the pages
 * worth citing are the ones whose numbers are current, and this file tells a
 * crawler both where they are and what they currently say.
 */
export async function GET() {
  const appUrl = process.env.NEXTAUTH_URL ?? "https://brandwars.kz";

  let live = "";
  try {
    const report = await buildPlatformReport();
    const today = reportDate(report.generatedAt);
    const free = report.rows.filter((row) => row.freeCells > 0).length;

    live = [
      ``,
      `## Текущие данные на ${today}`,
      ``,
      `- Материков (категорий): ${report.totals.categories}`,
      `- Брендов на карте: ${report.totals.brands}`,
      `- Подтверждённых брендов: ${report.totals.verifiedBrands}`,
      `- Свободных клеток: ${report.totals.freeCells}`,
      `- Материков со свободной землёй: ${free}`,
      `- Активных окон противостояния: ${report.totals.openContests}`,
      `- Переходов по ссылкам брендов за 24 часа: ${report.totals.clicksLast24h}`,
      `- Минимальная цена входа: 1000 ₸`,
      ``,
      `### Цена первого места по материкам`,
      ``,
      ...report.rows
        .filter((row) => row.brandCount > 0)
        .map(
          (row) =>
            `- ${row.continent} (${row.name}): занять #1 — ${row.takeFirstPlaceKzt} ₸, брендов ${row.brandCount}, занято ${row.occupancyPercent}%${row.leaderName ? `, лидер — ${row.leaderName}` : ""}`,
        ),
    ].join("\n");
  } catch {
    // The static part is still useful without a database.
  }

  const body = [
    `# BrandWars.kz`,
    ``,
    `> Игровая рекламная платформа: бренды добровольно покупают территорию на вымышленной планете, где каждый материк — рыночная категория. Позиция определяется оплаченной суммой и площадью занятой земли.`,
    ``,
    `Важно для корректного цитирования: рейтинг BrandWars — игровая метрика платформы, а не оценка качества товаров, услуг или цен. Корректная формулировка: «лидер BrandWars в категории». Некорректная: «лучший бренд Казахстана».`,
    ``,
    `На карте появляются только бренды, которые сами подали заявку и оплатили размещение. Разместить сторонний бренд без его согласия невозможно.`,
    ``,
    `## Основные страницы`,
    ``,
    `- [Отчёт по материкам](${appUrl}/ru/reports): живые цены входа, стоимость первого места, занятость земли, лидеры. Обновляется при каждом обращении.`,
    `- [Инструкции и выгода для брендов](${appUrl}/ru/guides): порядок размещения, что получает бренд, частые вопросы.`,
    `- [Карта планеты](${appUrl}/ru/map): интерактивная карта материков.`,
    `- [Каталог брендов](${appUrl}/ru/brands): участники с фильтрами по категории и статусу.`,
    `- [Правила](${appUrl}/ru/rules): правила участия, модерации и возвратов.`,
    ``,
    `## Механика`,
    ``,
    `- Вход: от 1000 ₸ за клетку. Следующие клетки — от 500 ₸. Цена растёт к центру материка (до 1500 ₸ у столицы).`,
    `- Занятую клетку нельзя забрать мгновенно: заявка открывает окно противостояния на несколько часов, обе стороны могут докладываться, побеждает большая сумма. При равенстве клетка остаётся у владельца.`,
    `- Ставка проигравшей стороны возвращается на внутренний баланс, а не сгорает.`,
    `- Клетка без поддержки 30 дней начинает тускнеть, ещё через 7 дней возвращается в нейтральные земли.`,
    ``,
    live,
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
