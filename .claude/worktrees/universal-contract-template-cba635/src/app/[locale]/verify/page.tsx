import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

const METHODS = [
  {
    id: "email",
    title: "Корпоративная почта",
    desc: "Подтвердите домен email компании",
  },
  {
    id: "dns",
    title: "DNS TXT запись",
    desc: "Добавьте TXT-запись brandwars-verify=...",
  },
  {
    id: "meta",
    title: "Meta-тег",
    desc: '<meta name="brandwars-verify" content="..." />',
  },
  {
    id: "file",
    title: "HTML-файл",
    desc: "Загрузите brandwars-verify.html в корень сайта",
  },
];

export default async function VerifyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Верификация бренда</h1>
      <p className="text-muted">
        Подтверждение владельца даёт бейдж «Проверенный бренд» на карточке.
      </p>
      <div className="space-y-3">
        {METHODS.map((m) => (
          <div key={m.id} className="surface-card">
            <h2 className="font-semibold text-ink">{m.title}</h2>
            <p className="mt-1 text-sm text-muted">{m.desc}</p>
            <button
              type="button"
              disabled
              className="btn-secondary mt-3 px-3 py-1.5 text-xs opacity-60"
            >
              Скоро (MVP stub)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
