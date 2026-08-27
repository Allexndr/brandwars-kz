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
      <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
      <p className="text-muted">{session?.user?.email ?? session?.user?.name ?? "Пользователь"}</p>

      <div className="surface-card">
        <h2 className="font-semibold text-ink">{t("topUp")}</h2>
        <p className="mt-1 text-xs text-muted">
          Battle Power обновляется только после подтверждённого платежа. Возвраты и chargeback
          пересчитывают территорию.
        </p>
        <form onSubmit={handleTopUp} className="mt-4 space-y-3">
          <label className="block text-sm text-ink">
            {t("amount")}
            <input
              type="number"
              min={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input-field mt-1"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "..." : t("topUp")}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-accent">{message}</p>}
      </div>
    </div>
  );
}
