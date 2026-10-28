"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { moneyKzt } from "@/lib/payments/methods";

type Company = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
  paidKzt: number;
  paidCount: number;
  billingProfile: {
    kind: string;
    companyName: string | null;
    bin: string | null;
  } | null;
  wallet: { balance: number } | null;
  brands: Array<{ id: string; name: string; slug: string; verificationStatus: string }>;
  _count: { paymentOrders: number; brandClaims: number; transactions: number };
};

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kind) params.set("kind", kind);
    const res = await fetch(`/api/admin/companies?${params}`);
    const data = await res.json();
    if (res.ok) setCompanies(data.companies ?? []);
    setLoading(false);
  }, [q, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Компании и клиенты</h1>
        <p className="mt-1 text-sm text-muted">
          Юрлица, бренды, платежи и полный процесс по каждому аккаунту.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="email, компания, БИН"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все</option>
          <option value="company">Только юрлица</option>
          <option value="individual">Только физлица</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-[var(--radius-sm)] bg-ink px-3 py-2 text-sm text-white"
        >
          Найти
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Загрузка...</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Клиент</th>
                <th className="px-3 py-2">Тип</th>
                <th className="px-3 py-2">Бренды</th>
                <th className="px-3 py-2">Оплачено</th>
                <th className="px-3 py-2">Кошелёк</th>
                <th className="px-3 py-2">Активность</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/companies/${c.email || c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.billingProfile?.companyName || c.name || c.email || c.id}
                    </Link>
                    <div className="text-xs text-muted">{c.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {c.billingProfile?.kind === "COMPANY" ? "Юрлицо" : c.billingProfile ? "Физлицо" : "—"}
                    {c.billingProfile?.bin ? (
                      <div className="text-xs text-muted">БИН {c.billingProfile.bin}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {c.brands.length
                      ? c.brands.map((b) => b.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {moneyKzt(c.paidKzt)}
                    <div className="text-xs text-muted">{c.paidCount} платежей</div>
                  </td>
                  <td className="px-3 py-2">
                    {c.wallet ? moneyKzt(c.wallet.balance) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    заказов {c._count.paymentOrders} · заявок {c._count.brandClaims} · tx{" "}
                    {c._count.transactions}
                  </td>
                </tr>
              ))}
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted">
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
