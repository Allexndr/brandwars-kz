"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  isActive: boolean;
  verificationStatus: string;
  createdAt: string;
  owner: { email: string | null; name: string | null } | null;
  primaryCategory: { nameRu: string; continentRu: string } | null;
  territories: Array<{ cellCount: number; battlePower: number }>;
  _count: { paymentOrders: number; cells: number };
};

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/brands?${params}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Ошибка");
      setLoading(false);
      return;
    }
    setBrands(json.brands ?? []);
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Бренды</h2>
        <p className="text-sm text-muted">
          Верификация, активация и полный след по бренду.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, slug, сайт"
          className="min-w-[220px] flex-1 rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все</option>
          <option value="active">Активные</option>
          <option value="inactive">Выключенные</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
        </select>
        <button type="button" onClick={load} className="btn-primary">
          Обновить
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-muted">Загрузка…</p>
      ) : (
        <div className="overflow-x-auto rounded-brand border border-[var(--color-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/[0.03] text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Бренд</th>
                <th className="px-3 py-2">Материк</th>
                <th className="px-3 py-2">Владелец</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">Клетки</th>
                <th className="px-3 py-2">Платежи</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/brands/${brand.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {brand.name}
                    </Link>
                    <p className="text-xs text-muted">{brand.slug}</p>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {brand.primaryCategory?.nameRu ?? "—"}
                    <br />
                    <span className="text-xs">
                      {brand.primaryCategory?.continentRu}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {brand.owner?.email || brand.owner?.name || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs">
                      {brand.verificationStatus}
                      {!brand.isActive ? " · OFF" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2">{brand._count.cells}</td>
                  <td className="px-3 py-2">{brand._count.paymentOrders}</td>
                </tr>
              ))}
              {brands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted">
                    Брендов нет
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
