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
      <h1 className="text-3xl font-bold">Верификация бренда</h1>
      <p className="text-slate-400">
        Подтверждение владельца даёт бейдж «Проверенный бренд» на карточке.
      </p>
      <div className="space-y-3">
        {METHODS.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
          >
            <h2 className="font-semibold">{m.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{m.desc}</p>
            <button
              type="button"
              disabled
              className="mt-3 rounded border border-slate-700 px-3 py-1 text-xs text-slate-500"
            >
              Скоро (MVP stub)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
