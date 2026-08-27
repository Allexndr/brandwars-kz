"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const t = useTranslations("nav");
  const tc = useTranslations("claim");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/ru/claim-brand";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("nodemailer", { email, callbackUrl });
    setLoading(false);
  }

  return (
    <div className="surface-card mx-auto max-w-md space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">{t("login")}</h1>
      <p className="text-sm text-muted">{tc("loginRequired")}</p>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="btn-secondary w-full"
      >
        Google
      </button>

      <div className="relative text-center text-xs text-muted">
        <span className="bg-[var(--color-surface)] px-2">или email</span>
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.kz"
          className="input-field"
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          Получить ссылку для входа
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
