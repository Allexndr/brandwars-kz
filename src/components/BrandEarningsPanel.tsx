"use client";

import { useCallback, useEffect, useState } from "react";
import { formatApiError } from "@/lib/format-api-error";
import { moneyKzt } from "@/lib/payments/methods";

type EarningsItem = {
  brand: {
    id: string;
    name: string;
    slug: string;
    verificationStatus: string;
  };
  earnings: {
    availableKzt: number;
    reservedKzt: number;
    lifetimeEarnedKzt: number;
    lifetimeWithdrawnKzt: number;
    brandShareBps: number;
    withdrawMinKzt: number;
    entries: Array<{
      id: string;
      type: string;
      amountKzt: number;
      grossKzt: number | null;
      platformFeeKzt: number | null;
      note: string | null;
      createdAt: string;
    }>;
    withdrawals: Array<{
      id: string;
      amountKzt: number;
      status: string;
      createdAt: string;
      payoutDetails: string;
    }>;
  };
};

export function BrandEarningsPanel() {
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [amount, setAmount] = useState(10_000);
  const [payoutDetails, setPayoutDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/earnings");
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Ошибка"));
      const list = (data.items ?? []) as EarningsItem[];
      setItems(list);
      setSelectedBrandId((prev) => prev || list[0]?.brand.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((item) => item.brand.id === selectedBrandId);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: selected.brand.id,
          amountKzt: amount,
          payoutDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Не удалось"));
      setMessage("Заявка на вывод создана. Переведём вручную после проверки.");
      setPayoutDetails("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-card text-sm text-muted">Загрузка счёта…</div>
    );
  }

  if (error) {
    return <div className="surface-card text-sm text-red-700">{error}</div>;
  }

  if (items.length === 0) {
    return null;
  }

  const sharePct = Math.round((selected?.earnings.brandShareBps ?? 8000) / 100);

  return (
    <div className="surface-card space-y-4">
      <div>
        <h2 className="font-semibold text-ink">Заработок с поддержки</h2>
        <p className="mt-1 text-xs text-muted">
          Фаны платят за силу на карте — {sharePct}% зачисляется бренду, остальное
          платформе. Вывод после верификации.
        </p>
      </div>

      {items.length > 1 ? (
        <label className="block text-sm text-ink">
          Бренд
          <select
            className="input-field mt-1"
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
          >
            {items.map((item) => (
              <option key={item.brand.id} value={item.brand.id}>
                {item.brand.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm font-medium text-ink">{selected?.brand.name}</p>
      )}

      {selected ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                Доступно
              </p>
              <p className="font-display text-xl font-semibold tabular-nums text-ink">
                {moneyKzt(selected.earnings.availableKzt)}
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                В заявке
              </p>
              <p className="font-display text-xl font-semibold tabular-nums text-ink">
                {moneyKzt(selected.earnings.reservedKzt)}
              </p>
            </div>
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                Всего заработано
              </p>
              <p className="font-display text-xl font-semibold tabular-nums text-ink">
                {moneyKzt(selected.earnings.lifetimeEarnedKzt)}
              </p>
            </div>
          </div>

          <form onSubmit={handleWithdraw} className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs text-muted">
              Минимум {moneyKzt(selected.earnings.withdrawMinKzt)}. Статус:{" "}
              {selected.brand.verificationStatus === "VERIFIED"
                ? "верифицирован"
                : "нужна верификация для вывода"}
            </p>
            <label className="block text-sm text-ink">
              Сумма вывода
              <input
                type="number"
                min={selected.earnings.withdrawMinKzt}
                step={500}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="input-field mt-1"
              />
            </label>
            <label className="block text-sm text-ink">
              Куда перевести
              <textarea
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder="Kaspi / карта / ИИК + БИН"
                rows={2}
                className="input-field mt-1"
                required
              />
            </label>
            <button
              type="submit"
              disabled={
                submitting ||
                selected.brand.verificationStatus !== "VERIFIED" ||
                selected.earnings.availableKzt < selected.earnings.withdrawMinKzt
              }
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "…" : "Запросить вывод"}
            </button>
            {message ? <p className="text-sm text-accent">{message}</p> : null}
          </form>

          {selected.earnings.withdrawals.length > 0 ? (
            <div className="border-t border-[var(--color-border)] pt-3">
              <p className="text-xs uppercase tracking-wide text-muted">Заявки</p>
              <ul className="mt-2 space-y-1 text-sm">
                {selected.earnings.withdrawals.map((w) => (
                  <li key={w.id} className="flex justify-between gap-2 text-ink">
                    <span>
                      {moneyKzt(w.amountKzt)} · {w.status}
                    </span>
                    <span className="text-muted">
                      {new Date(w.createdAt).toLocaleDateString("ru-KZ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selected.earnings.entries.length > 0 ? (
            <div className="border-t border-[var(--color-border)] pt-3">
              <p className="text-xs uppercase tracking-wide text-muted">
                История начислений
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {selected.earnings.entries.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-ink">
                      {entry.type === "SUPPORT_CREDIT"
                        ? `Поддержка${entry.grossKzt ? ` ${moneyKzt(entry.grossKzt)}` : ""}`
                        : entry.type}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${
                        entry.amountKzt >= 0 ? "text-emerald-700" : "text-muted"
                      }`}
                    >
                      {entry.amountKzt >= 0 ? "+" : ""}
                      {moneyKzt(entry.amountKzt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
