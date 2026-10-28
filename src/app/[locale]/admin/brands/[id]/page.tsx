"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { moneyKzt, providerLabel } from "@/lib/payments/methods";

type BrandDetail = {
  brand: {
    id: string;
    name: string;
    slug: string;
    websiteUrl: string | null;
    isActive: boolean;
    verificationStatus: string;
    owner: { id: string; email: string | null; name: string | null } | null;
    primaryCategory: { nameRu: string; continentRu: string } | null;
    earningsWallet: {
      availableKzt: number;
      reservedKzt: number;
      lifetimeEarnedKzt: number;
    } | null;
    _count: { cells: number; paymentOrders: number; clicks: number };
  };
  recentPayments: Array<{
    id: string;
    amountKzt: number;
    status: string;
    paymentProvider: string;
    createdAt: string;
    appliedAt: string | null;
  }>;
};

export default function AdminBrandDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<BrandDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/brands/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Ошибка");
      return;
    }
    setData(json);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/brands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Ошибка");
      return;
    }
    await load();
  }

  if (!data && !error) return <p className="text-muted">Загрузка…</p>;
  if (error && !data) return <p className="text-red-700">{error}</p>;
  if (!data) return null;

  const { brand, recentPayments } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/brands" className="text-sm text-muted hover:underline">
          ← Бренды
        </Link>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
          {brand.name}
        </h2>
        <p className="text-sm text-muted">
          {brand.slug} · {brand.primaryCategory?.nameRu} ·{" "}
          {brand.primaryCategory?.continentRu}
        </p>
        {brand.websiteUrl ? (
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {brand.websiteUrl}
          </a>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-brand border border-[var(--color-border)] p-3">
          <p className="text-xs text-muted">Верификация</p>
          <p className="font-semibold">{brand.verificationStatus}</p>
        </div>
        <div className="rounded-brand border border-[var(--color-border)] p-3">
          <p className="text-xs text-muted">Активен</p>
          <p className="font-semibold">{brand.isActive ? "да" : "нет"}</p>
        </div>
        <div className="rounded-brand border border-[var(--color-border)] p-3">
          <p className="text-xs text-muted">Клетки / клики</p>
          <p className="font-semibold">
            {brand._count.cells} / {brand._count.clicks}
          </p>
        </div>
        <div className="rounded-brand border border-[var(--color-border)] p-3">
          <p className="text-xs text-muted">Earnings доступно</p>
          <p className="font-semibold">
            {moneyKzt(brand.earningsWallet?.availableKzt ?? 0)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => act("verify")}
          className="rounded-brand bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Verify
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act("reject_verification")}
          className="rounded-brand border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          Reject verification
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(brand.isActive ? "deactivate" : "activate")}
          className="rounded-brand border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          {brand.isActive ? "Выключить" : "Включить"}
        </button>
      </div>

      <p className="text-sm text-muted">
        Владелец: {brand.owner?.email || brand.owner?.name || "—"}
      </p>

      <section className="space-y-2">
        <h3 className="font-semibold text-ink">Последние платежи</h3>
        <ul className="space-y-2">
          {recentPayments.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/payments/${p.id}`}
                className="flex flex-wrap justify-between gap-2 rounded-brand border border-[var(--color-border)] px-3 py-2 text-sm hover:border-ink"
              >
                <span>
                  {moneyKzt(p.amountKzt)} · {providerLabel(p.paymentProvider)} ·{" "}
                  {p.status}
                </span>
                <span className="text-muted">
                  {new Date(p.createdAt).toLocaleString("ru-KZ")}
                </span>
              </Link>
            </li>
          ))}
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted">Платежей нет</p>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
