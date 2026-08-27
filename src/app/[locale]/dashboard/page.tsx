"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { formatApiError } from "@/lib/format-api-error";

function DashboardInner() {
  const { data: session } = useSession();
  const t = useTranslations("dashboard");
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(2000);
  const [brandId, setBrandId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const topUp = searchParams.get("topUp");
    const brand = searchParams.get("brandId");
    if (topUp && Number(topUp) > 0) setAmount(Number(topUp));
    if (brand) setBrandId(brand);
    if (searchParams.get("paid") === "1") {
      setMessage("Оплата принята. Сила поддержки обновится после подтверждения webhook.");
    }
  }, [searchParams]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKzt: amount, brandId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Ошибка оплаты"));

      if (data.paymentUrl && !data.testMode) {
        window.location.href = data.paymentUrl;
        return;
      }

      setMessage(
        data.testMode
          ? `Тестовый заказ ${data.order.id}. В проде откроется Lemon Squeezy (карта / Google Pay).`
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
          Оплата через Lemon Squeezy: карта, Google Pay, Apple Pay. Battle Power растёт после
          подтверждённого платежа.
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
            {loading ? "..." : "Оплатить картой / Google Pay"}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-accent">{message}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}
