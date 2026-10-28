"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { moneyKzt, providerLabel } from "@/lib/payments/methods";

type CompanyDetail = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
    billingProfile: {
      kind: string;
      companyName: string | null;
      bin: string | null;
      address: string | null;
      contactName: string | null;
      contactPhone: string | null;
      email: string | null;
    } | null;
    wallet: {
      balance: number;
      transactions: Array<{
        id: string;
        type: string;
        amount: number;
        description: string | null;
        createdAt: string;
      }>;
    } | null;
    brands: Array<{
      id: string;
      name: string;
      slug: string;
      verificationStatus: string;
      websiteUrl: string | null;
      primaryCategory: { nameRu: string };
      cells: Array<{ id: string; q: number; r: number; state: string; layer: string; priceKzt: number }>;
      territories: Array<{
        battlePower: number;
        territoryShare: number;
        rank: number;
        seasonCategory: { category: { nameRu: string } };
      }>;
    }>;
  };
  paidByProvider: Record<string, { count: number; amountKzt: number }>;
  process: Array<{
    at: string;
    type: string;
    id: string;
    title: string;
    status: string;
    amountKzt: number | null;
    href: string | null;
  }>;
};

export default function AdminCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/admin/companies/${encodeURIComponent(params.id)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Не найдено");
        setData(json);
      })
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-muted">Загрузка...</p>;

  const { user, paidByProvider, process } = data;
  const billing = user.billingProfile;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/companies" className="text-sm text-muted hover:underline">
          ← Все компании
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          {billing?.companyName || user.name || user.email}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {user.email} · {user.role} · с {new Date(user.createdAt).toLocaleDateString("ru-KZ")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm">
          <h2 className="font-semibold text-ink">Реквизиты</h2>
          {billing ? (
            <div className="mt-2 space-y-1">
              <p>{billing.kind === "COMPANY" ? "Юрлицо" : "Физлицо"}</p>
              <p>БИН/ИИН: {billing.bin || "—"}</p>
              <p>Адрес: {billing.address || "—"}</p>
              <p>
                Контакт: {billing.contactName || "—"} {billing.contactPhone || ""}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-muted">Профиль плательщика пуст</p>
          )}
          <p className="mt-3">
            Кошелёк: {user.wallet ? moneyKzt(user.wallet.balance) : "—"}
          </p>
        </section>

        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm lg:col-span-2">
          <h2 className="font-semibold text-ink">Оплаты по каналам</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-1 pr-3">Канал</th>
                  <th className="py-1 pr-3">Сумма</th>
                  <th className="py-1">Платежей</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(paidByProvider).map(([provider, row]) => (
                  <tr key={provider} className="border-t border-[var(--color-border)]">
                    <td className="py-1 pr-3">{providerLabel(provider)}</td>
                    <td className="py-1 pr-3">{moneyKzt(row.amountKzt)}</td>
                    <td className="py-1">{row.count}</td>
                  </tr>
                ))}
                {Object.keys(paidByProvider).length === 0 ? (
                  <tr>
                    <td className="py-2 text-muted" colSpan={3}>
                      Оплат ещё не было
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Бренды</h2>
        {user.brands.length === 0 ? (
          <p className="text-sm text-muted">Брендов нет</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {user.brands.map((brand) => (
              <div
                key={brand.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm"
              >
                <p className="font-semibold text-ink">{brand.name}</p>
                <p className="text-muted">
                  {brand.primaryCategory.nameRu} · {brand.verificationStatus}
                </p>
                {brand.websiteUrl ? <p>{brand.websiteUrl}</p> : null}
                <p className="mt-2 text-xs text-muted">
                  Клеток: {brand.cells.length} · территорий: {brand.territories.length}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Полный процесс</h2>
        <ol className="space-y-3">
          {process.map((step) => (
            <li
              key={`${step.type}-${step.id}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">
                    {new Date(step.at).toLocaleString("ru-KZ")} · {step.type}
                  </p>
                  {step.href ? (
                    <Link href={step.href} className="font-medium text-ink hover:underline">
                      {step.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-ink">{step.title}</p>
                  )}
                </div>
                <div className="text-right">
                  <p>{step.status}</p>
                  {step.amountKzt != null ? (
                    <p className="text-muted">{moneyKzt(step.amountKzt)}</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
