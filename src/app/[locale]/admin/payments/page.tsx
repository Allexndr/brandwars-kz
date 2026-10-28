"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { moneyKzt, providerLabel } from "@/lib/payments/methods";

type Order = {
  id: string;
  amountKzt: number;
  status: string;
  paymentProvider: string;
  providerOrderId: string | null;
  idempotencyKey: string;
  appliedAt: string | null;
  createdAt: string;
  user: { id: string; email: string | null; name: string | null };
  brand: { id: string; name: string; slug: string } | null;
  brandClaim: { id: string; brandName: string; status: string } | null;
  transaction: { id: string; type: string; status: string } | null;
  invoice: { id: string; number: number; payerName: string } | null;
};

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [q, setQ] = useState("");
  const [stuck, setStuck] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    if (q.trim()) params.set("q", q.trim());
    if (stuck) params.set("stuck", "1");
    const res = await fetch(`/api/admin/payments?${params}`);
    const data = await res.json();
    if (res.ok) {
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [status, provider, q, stuck]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Платежи</h1>
        <p className="mt-1 text-sm text-muted">
          Все каналы: Карта, Kaspi, Prodamus. Найдено: {total}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="email, бренд, order id"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          {["PENDING", "PAID", "FAILED", "REFUNDED", "CHARGEBACK", "DISPUTED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все провайдеры</option>
          <option value="prodamus">Prodamus</option>
          <option value="unicorn">Карта</option>
          <option value="prodamus">Prodamus</option>
          <option value="kaspi">Kaspi</option>
          <option value="card">card (legacy)</option>
          <option value="test">test</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={stuck} onChange={(e) => setStuck(e.target.checked)} />
          PAID без apply
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-[var(--radius-sm)] bg-ink px-3 py-2 text-sm text-white"
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Загрузка...</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Клиент</th>
                <th className="px-3 py-2">Объект</th>
                <th className="px-3 py-2">Канал</th>
                <th className="px-3 py-2">Сумма</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">Счёт</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-3 py-2 text-muted whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString("ru-KZ")}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/companies/${o.user.email || o.user.id}`}
                      className="hover:underline"
                    >
                      {o.user.name || o.user.email}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/payments/${o.id}`} className="font-medium hover:underline">
                      {o.brandClaim?.brandName || o.brand?.name || o.idempotencyKey}
                    </Link>
                    <div className="text-xs text-muted">{o.id}</div>
                  </td>
                  <td className="px-3 py-2">{providerLabel(o.paymentProvider)}</td>
                  <td className="px-3 py-2">{moneyKzt(o.amountKzt)}</td>
                  <td className="px-3 py-2">
                    {o.status}
                    {o.status === "PAID" && !o.appliedAt ? (
                      <div className="text-xs text-amber-700">не применён</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {o.invoice ? `№${o.invoice.number}` : "—"}
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-muted">
                    Ничего не найдено
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
