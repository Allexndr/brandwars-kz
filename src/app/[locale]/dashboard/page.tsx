"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function DashboardPage() {
  const { data: session } = useSession();
  const t = useTranslations("dashboard");
  const [amount, setAmount] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKzt: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setMessage(
        data.testMode
          ? `Тестовый заказ создан. ID: ${data.order.id}. Подтвердите через webhook.`
          : `Заказ создан: ${data.order.id}`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-slate-400">
        {session?.user?.email ?? session?.user?.name ?? "Пользователь"}
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold">{t("topUp")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Battle Power обновляется только после подтверждённого платежа.
          Возвраты и chargeback пересчитывают территорию.
        </p>
        <form onSubmit={handleTopUp} className="mt-4 space-y-3">
          <label className="block text-sm">
            {t("amount")}
            <input
              type="number"
              min={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-sky-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? "..." : t("topUp")}
          </button>
        </form>
        {message && (
          <p className="mt-3 text-sm text-sky-300">{message}</p>
        )}
      </div>
    </div>
  );
}
