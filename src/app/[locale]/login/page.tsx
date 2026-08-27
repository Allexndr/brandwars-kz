"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const t = useTranslations("nav");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/ru/dashboard";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("nodemailer", { email, callbackUrl });
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h1 className="text-2xl font-bold">{t("login")}</h1>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="w-full rounded border border-slate-600 py-2 text-sm hover:border-sky-600"
      >
        Google
      </button>

      <div className="relative text-center text-xs text-slate-500">
        <span className="bg-slate-900 px-2">или email</span>
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.kz"
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-sky-600 py-2 text-sm disabled:opacity-50"
        >
          Magic link
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
