"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { moneyKzt, providerLabel } from "@/lib/payments/methods";

type Overview = {
  totals: {
    paidKzt: number;
    paidCount: number;
    paid7dKzt: number;
    paid7dCount: number;
    paid30dKzt: number;
    paid30dCount: number;
    pendingCount: number;
    stuckPaidCount: number;
    openModeration: number;
    brandCount: number;
    companyProfiles: number;
    withdrawalsPendingKzt?: number;
    withdrawalsPendingCount?: number;
    earningsAvailableKzt?: number;
    earningsReservedKzt?: number;
  };
  byProvider: Record<
    string,
    { paidKzt: number; paidCount: number; pendingCount: number }
  >;
  recentPayments: Array<{
    id: string;
    amountKzt: number;
    status: string;
    paymentProvider: string;
    createdAt: string;
    user: { email: string | null; name: string | null };
    brand: { name: string; slug: string } | null;
    brandClaim: { brandName: string; status: string } | null;
  }>;
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default function AdminHomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        setData(json);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-muted">Загрузка дашборда...</p>;

  const { totals, byProvider, recentPayments } = data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Операционный дашборд
        </h2>
        <p className="mt-1 text-sm text-muted">
          Деньги, провайдеры, застрявшие оплаты и выводы.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Оплачено всего" value={moneyKzt(totals.paidKzt)} hint={`${totals.paidCount} платежей`} />
        <Stat label="За 7 дней" value={moneyKzt(totals.paid7dKzt)} hint={`${totals.paid7dCount} платежей`} />
        <Stat label="За 30 дней" value={moneyKzt(totals.paid30dKzt)} hint={`${totals.paid30dCount} платежей`} />
        <Stat label="В ожидании" value={String(totals.pendingCount)} hint={totals.stuckPaidCount ? `Застряло после оплаты: ${totals.stuckPaidCount}` : undefined} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Выводы в очереди"
          value={moneyKzt(totals.withdrawalsPendingKzt ?? 0)}
          hint={`${totals.withdrawalsPendingCount ?? 0} заявок`}
        />
        <Stat
          label="Earnings доступно"
          value={moneyKzt(totals.earningsAvailableKzt ?? 0)}
          hint={`Резерв: ${moneyKzt(totals.earningsReservedKzt ?? 0)}`}
        />
        <Stat label="Бренды" value={String(totals.brandCount)} />
        <Stat label="Модерация" value={String(totals.openModeration)} />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Куда уходят деньги</h2>
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Провайдер</th>
                <th className="px-3 py-2">Оплачено</th>
                <th className="px-3 py-2">Платежей</th>
                <th className="px-3 py-2">Ожидают</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byProvider).map(([provider, row]) => (
                <tr key={provider} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-medium text-ink">{providerLabel(provider)}</td>
                  <td className="px-3 py-2">{moneyKzt(row.paidKzt)}</td>
                  <td className="px-3 py-2">{row.paidCount}</td>
                  <td className="px-3 py-2">{row.pendingCount}</td>
                </tr>
              ))}
              {Object.keys(byProvider).length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted" colSpan={4}>
                    Пока нет платежей
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Последние платежи</h2>
          <Link href="/admin/payments" className="text-sm text-primary hover:underline">
            Все платежи
          </Link>
        </div>
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2">Клиент</th>
                <th className="px-3 py-2">Что</th>
                <th className="px-3 py-2">Канал</th>
                <th className="px-3 py-2">Сумма</th>
                <th className="px-3 py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 text-muted">
                    {new Date(p.createdAt).toLocaleString("ru-KZ")}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/companies/${p.user.email || p.id}`} className="hover:underline">
                      {p.user.name || p.user.email || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {p.brandClaim?.brandName || p.brand?.name || "—"}
                  </td>
                  <td className="px-3 py-2">{providerLabel(p.paymentProvider)}</td>
                  <td className="px-3 py-2">{moneyKzt(p.amountKzt)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/payments/${p.id}`} className="font-medium hover:underline">
                      {p.status}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
