"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { formatApiError } from "@/lib/format-api-error";

type BrandRow = {
  claimId: string;
  claimStatus: string;
  name: string;
  slug: string | null;
  continent: string | null;
  categorySlug: string | null;
  rank: number | null;
  cellCount: number;
  clickCount: number;
};

type Member = {
  id: string;
  role: string;
  user: { email: string | null; name: string | null };
};

/**
 * One screen for everything the account manages.
 *
 * Agencies are the largest cheque in this market and they buy for many clients:
 * without a consolidated view they have to open each brand separately to answer
 * "what did we get this month", which is the question that decides renewal.
 *
 * Only shown once there is more than one brand — for a single-brand owner it
 * would be noise.
 */
export function AgencyOverview({ locale = "ru" }: { locale?: string }) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/dashboard/brands", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { brands: [] }))
      .then((data: { brands: BrandRow[] }) => {
        if (alive) setBrands(data.brands ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded || brands.length < 2) return null;

  const totalClicks = brands.reduce((sum, b) => sum + b.clickCount, 0);
  const totalCells = brands.reduce((sum, b) => sum + b.cellCount, 0);
  const leaders = brands.filter((b) => b.rank === 1).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Все бренды аккаунта
        </h2>
        <p className="mt-1 text-sm text-muted">
          {brands.length} брендов · сводка по переходам и позициям
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Брендов" value={String(brands.length)} />
        <Stat label="Первых мест" value={String(leaders)} accent />
        <Stat label="Переходов всего" value={totalClicks.toLocaleString("ru-KZ")} />
        <Stat label="Клеток" value={String(totalCells)} />
      </dl>

      <div className="overflow-x-auto rounded-brand border border-[var(--color-border)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--color-surface-soft)] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Бренд</th>
              <th className="px-4 py-3 font-medium">Материк</th>
              <th className="px-4 py-3 font-medium">Место</th>
              <th className="px-4 py-3 font-medium">Клеток</th>
              <th className="px-4 py-3 font-medium">Переходов</th>
              <th className="px-4 py-3 font-medium">Доступ</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.claimId} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3">
                  {brand.slug ? (
                    <Link
                      href={`/brand/${brand.slug}`}
                      className="font-medium text-ink hover:text-[var(--color-primary)]"
                    >
                      {brand.name}
                    </Link>
                  ) : (
                    <span className="text-ink">{brand.name}</span>
                  )}
                  {brand.claimStatus !== "APPROVED" && (
                    <span className="ml-2 text-xs text-muted">на модерации</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{brand.continent ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">
                  {brand.rank ? `#${brand.rank}` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">{brand.cellCount}</td>
                <td className="px-4 py-3 tabular-nums">{brand.clickCount}</td>
                <td className="px-4 py-3">
                  {brand.slug ? (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFor(openFor === brand.slug ? null : brand.slug)
                      }
                      className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {openFor === brand.slug ? "Скрыть" : "Команда"}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openFor && <TeamPanel slug={openFor} />}
    </section>
  );
}

/** Seat management for one brand. */
function TeamPanel({ slug }: { slug: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [canAdmin, setCanAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/brands/${slug}/members`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { members: [], canAdmin: false }))
      .then((data) => {
        setMembers(data.members ?? []);
        setCanAdmin(Boolean(data.canAdmin));
      })
      .catch(() => undefined);
  };

  useEffect(load, [slug]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${slug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Не удалось добавить"));
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    await fetch(`/api/brands/${slug}/members?memberId=${memberId}`, {
      method: "DELETE",
    }).catch(() => undefined);
    load();
  }

  return (
    <div className="surface-card space-y-3">
      <h3 className="text-sm font-semibold text-ink">Доступ к бренду «{slug}»</h3>

      {members.length === 0 ? (
        <p className="text-sm text-muted">
          Пока только владелец. Добавьте коллегу, чтобы он мог управлять брендом.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="text-ink">
                {member.user.email ?? member.user.name ?? "—"}
                <span className="ml-2 text-xs text-muted">
                  {member.role === "OWNER" ? "владелец" : "менеджер"}
                </span>
              </span>
              {canAdmin && (
                <button
                  type="button"
                  onClick={() => remove(member.id)}
                  className="text-xs text-muted hover:text-[var(--color-primary)]"
                >
                  Убрать
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdmin && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email коллеги"
              className="flex-1 rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !/.+@.+\..+/.test(email)}
              className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Добавляем…" : "Дать доступ"}
            </button>
          </div>
          <p className="text-xs text-muted">
            Коллега войдёт по этой почте и сможет управлять брендом. Добавлять
            новые доступы может только владелец.
          </p>
        </>
      )}

      {error && (
        <p className="text-sm text-[var(--color-primary)]">{error}</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-brand bg-[var(--color-surface-soft)] px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${
          accent ? "text-[var(--color-primary)]" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
