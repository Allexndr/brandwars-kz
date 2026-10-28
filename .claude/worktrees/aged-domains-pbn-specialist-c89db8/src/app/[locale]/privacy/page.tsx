import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <article className="prose-article">
      <h1>Политика конфиденциальности</h1>
      <p>
        BrandWars.kz обрабатывает персональные данные в соответствии с законодательством
        Республики Казахстан. Мы собираем email, данные профиля и информацию о транзакциях для
        работы платформы.
      </p>
      <p>
        Данные хранятся на защищённых серверах. Вы можете запросить удаление аккаунта через
        support@brandwars.kz.
      </p>
    </article>
  );
}
