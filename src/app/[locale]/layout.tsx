import { notFound } from "next/navigation";
import { Literata, Manrope } from "next/font/google";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/Providers";
import "../globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-literata",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "ru" | "kk")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className={`${manrope.variable} ${literata.variable}`}>
      <body className="font-body">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
