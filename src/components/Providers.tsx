"use client";

import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type ProvidersProps = {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <SessionProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
          <Footer />
        </div>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
