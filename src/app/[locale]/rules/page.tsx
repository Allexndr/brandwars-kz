import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function RulesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <article className="prose-article">
      <h1>Правила BrandWars.kz</h1>
      <section className="space-y-4">
        <div>
          <h2>1. Игровая метрика</h2>
          <p>
            Рейтинг отражает силу поддержки и активность в рамках текущего сезона BrandWars. Мы
            используем формулировку «лидер BrandWars в категории», а не «лучший бренд Казахстана».
          </p>
        </div>
        <div>
          <h2>2. Территория</h2>
          <p>
            Доля территории рассчитывается по формуле sqrt(Battle Power) для сглаженного
            распределения между участниками категории.
          </p>
        </div>
        <div>
          <h2>3. Платежи</h2>
          <p>
            Battle Power увеличивается только после подтверждённого платежа. При возврате или
            chargeback сила пересчитывается.
          </p>
        </div>
        <div>
          <h2>4. Модерация</h2>
          <p>
            Спорные и фейковые карточки могут быть отклонены. Рекламные материалы помечаются как
            «Реклама».
          </p>
        </div>
      </section>
    </article>
  );
}
