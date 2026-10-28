import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buildPlatformReport, reportDate } from "@/lib/report-data";
import { syncCategoryCatalog } from "@/lib/category-sync";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Как разместить бренд на карте: инструкции и что это даёт",
    description:
      "Пошаговые инструкции по размещению бренда, цены, механика окон противостояния и что именно бренд получает: переходы, страницу, посты и OG-карточку.",
    alternates: { canonical: `/${locale}/guides` },
  };
}

/**
 * Instruction hub.
 *
 * Written as question-headings with the answer in the first two sentences,
 * because that is the structure answer engines lift. Live numbers are injected
 * from the platform so the page stays current on its own — citation falls off
 * sharply once a page is a few months stale, and nothing here should need a
 * human to refresh it.
 */
export default async function GuidesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await syncCategoryCatalog().catch(() => undefined);
  const report = await buildPlatformReport();
  const today = reportDate(report.generatedAt);

  const faq = [
    {
      q: "Сколько стоит разместить бренд на карте?",
      a: `Вход — от 1 000 ₸ за одну клетку. Каждая следующая клетка стоит от 500 ₸, а клетка рядом со столицей материка дороже — до 1 500 ₸, потому что цена растёт к центру. На ${today} свободная земля есть в ${report.rows.filter((r) => r.freeCells > 0).length} материках из ${report.totals.categories}.`,
    },
    {
      q: "Как быстро бренд появляется на карте?",
      a: "Заявка занимает 30–60 секунд: ссылка, материк, email, сумма. Аккаунт заранее не нужен — он создаётся из указанного email после оплаты. Дальше короткая проверка модератором, обычно до 10 минут в рабочее время, и территория появляется на карте.",
    },
    {
      q: "Что бренд получает за оплату?",
      a: "Территорию на карте с персонажем в фирменных цветах, публичную индексируемую страницу, счётчик переходов по ссылке, OG-карточку для шеринга, строку в ленте активности и упоминание в постах платформы при заметных событиях. Переходы видны публично — это проверяемый результат, а не обещание.",
    },
    {
      q: "Что такое окно противостояния?",
      a: "Если клетка занята, её нельзя забрать мгновенно. Заявка открывает окно на несколько часов: обе стороны могут докладываться, и по закрытию клетку получает тот, чья сумма выше. При равных суммах клетка остаётся у владельца. Ставка проигравшей стороны возвращается на баланс и может быть потрачена на другие клетки.",
    },
    {
      q: "Можно ли потерять оплаченную территорию?",
      a: "Клетка требует поддержки. Если по ней 30 дней не было платежей, она начинает тускнеть, и у владельца есть ещё 7 дней, чтобы вернуться — тогда ничего не теряется. Только после этого клетка возвращается в нейтральные земли. Правила распада и возвратов видны до оплаты.",
    },
    {
      q: "Это рейтинг лучших брендов?",
      a: "Нет. Позиция определяется оплаченной суммой и площадью занятой земли — это игровая метрика платформы. Мы используем формулировку «лидер BrandWars в категории», а не «лучший бренд», и рейтинг не отражает качество товаров, услуг или цен.",
    },
    {
      q: "Можно ли добавить конкурента без его согласия?",
      a: "Нет. На карте появляются только бренды, которые сами подали заявку и оплатили размещение. Разместить чужой бренд или поставить его в невыгодное положение нельзя — это принципиальное ограничение платформы.",
    },
    {
      q: "Что происходит с деньгами, если клетку не удалось забрать?",
      a: "Ставка проигравшей в окне стороны зачисляется на внутренний баланс и может быть потрачена на другие клетки или на поддержку уже занятых. Деньги не сгорают.",
    },
  ];

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            dateModified: report.generatedAt.toISOString(),
            mainEntity: faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />

      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Инструкции · актуально на {today}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink md:text-4xl">
          Как разместить бренд на карте и что это даёт
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Вход — от 1 000 ₸, заявка занимает меньше минуты, аккаунт заранее не
          нужен. Ниже — пошаговый порядок, цены по материкам и полный список
          того, что бренд получает за размещение.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Порядок размещения: 4 шага
        </h2>
        <ol className="space-y-3">
          {[
            {
              t: "Вставьте ссылку",
              d: "Сайт, Telegram, Instagram, YouTube, App Store или Google Play. Название, описание и иконка подтягиваются автоматически.",
            },
            {
              t: "Выберите материк",
              d: `Материк определяется по ссылке автоматически, но его можно сменить вручную. Всего материков — ${report.totals.categories}.`,
            },
            {
              t: "Укажите сумму и оплатите",
              d: "От 1 000 ₸. Сумма определяет позицию: чем больше вложено, тем больше территория. Аккаунт создастся из указанного email.",
            },
            {
              t: "Пройдите проверку",
              d: "Модератор подтверждает, что бренд реальный и заявитель имеет право им управлять. Обычно до 10 минут в рабочее время.",
            },
          ].map((step, index) => (
            <li key={step.t} className="flex gap-4">
              <span className="step-dot step-dot-active shrink-0">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold text-ink">{step.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Что бренд получает за размещение
        </h2>
        <p className="text-sm text-muted">
          Размещение — это не строчка в списке, а пакет дистрибуции. Каждый пункт
          работает автоматически, без отдельной оплаты.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ["Территория на карте", "С персонажем в фирменных цветах бренда, подобранных из его логотипа."],
            ["Счётчик переходов", "Публичный и проверяемый: видно, сколько людей перешло по ссылке."],
            ["Индексируемая страница", "Отдельная страница бренда с описанием, категорией и позицией."],
            ["OG-карточка", "Готовое превью для Telegram, WhatsApp и соцсетей."],
            ["Упоминание в постах", "Заметные события с брендом попадают в соцсети платформы. Можно отключить."],
            ["Лента активности", "Каждое действие бренда видно посетителям в реальном времени."],
            ["Уведомление об обходе", "Письмо, когда бренд теряет позицию, с точной суммой для возврата."],
            ["Место на гео-странице", "Страница города открывается, когда в нём набирается достаточно брендов."],
          ].map(([title, body]) => (
            <li
              key={title}
              className="rounded-brand border border-[var(--color-border)] p-4"
            >
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Цены на {today}
        </h2>
        <div className="overflow-x-auto rounded-brand border border-[var(--color-border)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[var(--color-surface-soft)] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Материк</th>
                <th className="px-4 py-3 font-medium">Вход от</th>
                <th className="px-4 py-3 font-medium">Занять #1</th>
                <th className="px-4 py-3 font-medium">Свободно</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.slice(0, 12).map((row) => (
                <tr key={row.slug} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/category/${row.slug}`}
                      className="text-ink hover:text-[var(--color-primary)]"
                    >
                      {row.continent}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">1 000 ₸</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.takeFirstPlaceKzt.toLocaleString("ru-KZ")} ₸
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.freeCells}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/reports" className="inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
          Полный отчёт по всем материкам →
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Частые вопросы
        </h2>
        <div className="space-y-3">
          {faq.map((item) => (
            <details
              key={item.q}
              className="rounded-brand border border-[var(--color-border)] p-4"
            >
              <summary className="cursor-pointer font-semibold text-ink">
                {item.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-6">
        <Link href="/claim-brand" className="btn-primary">
          Занять место от 1 000 ₸
        </Link>
        <Link href="/reports" className="btn-secondary">
          Отчёт по материкам
        </Link>
        <Link href="/rules" className="btn-secondary">
          Правила
        </Link>
      </footer>
    </div>
  );
}
