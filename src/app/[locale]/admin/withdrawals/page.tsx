"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { moneyKzt } from "@/lib/payments/methods";

type Row = {
  id: string;
  amountKzt: number;
  status: string;
  payoutDetails: string;
  adminNote: string | null;
  createdAt: string;
  brand: { id: string; name: string; slug: string; verificationStatus: string };
  requestedBy: { email: string | null; name: string | null };
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/withdrawals");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Ошибка");
      return;
    }
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject" | "paid") {
    setBusyId(id);
    try {
      const note =
        action === "reject"
          ? window.prompt("Причина отклонения (необязательно)") ?? undefined
          : action === "paid"
            ? window.prompt("Комментарий к выплате (необязательно)") ?? undefined
            : undefined;
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:underline">
          ← Дашборд
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          Выводы брендов
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ручные выплаты с earnings-счёта (80% от поддержки фанатов).
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Когда</th>
              <th className="px-3 py-2">Бренд</th>
              <th className="px-3 py-2">Сумма</th>
              <th className="px-3 py-2">Реквизиты</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-border)] align-top">
                <td className="px-3 py-2 text-muted whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString("ru-KZ")}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-ink">{row.brand.name}</div>
                  <div className="text-xs text-muted">
                    {row.requestedBy.email || row.requestedBy.name || "—"} ·{" "}
                    {row.brand.verificationStatus}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">{moneyKzt(row.amountKzt)}</td>
                <td className="px-3 py-2 max-w-[220px] whitespace-pre-wrap text-xs">
                  {row.payoutDetails}
                </td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.status === "PENDING" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => act(row.id, "approve")}
                          className="rounded bg-ink px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => act(row.id, "reject")}
                          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </>
                    ) : null}
                    {row.status === "PENDING" || row.status === "APPROVED" ? (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => act(row.id, "paid")}
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Выплачено
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted" colSpan={6}>
                  Заявок пока нет
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
