import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <article className="prose-article">
      <h1>Условия использования</h1>
      <p>
        Используя BrandWars.kz, вы соглашаетесь, что рейтинги и территории — игровые метрики
        платформы, а не объективная оценка качества брендов.
      </p>
      <p>
        Оплата даёт право на участие в сезоне и видимость на карте при успешной модерации.
        Возвраты регулируются правилами платёжного провайдера.
      </p>
    </article>
  );
}
