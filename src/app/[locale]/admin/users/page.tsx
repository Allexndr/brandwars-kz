"use client";

import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
  _count: { ownedBrands: number; paymentOrders: number };
};

const ROLES = ["USER", "BRAND_OWNER", "MODERATOR", "ADMIN"] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    const res = await fetch(`/api/admin/users?${params}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Ошибка");
      return;
    }
    setUsers(json.users ?? []);
  }, [q, role]);

  useEffect(() => {
    load();
  }, [load]);

  async function setUserRole(userId: string, nextRole: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: nextRole }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Ошибка смены роли");
      return;
    }
    setOk(`${json.user.email} → ${json.user.role}`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Роли</h2>
        <p className="text-sm text-muted">
          Смена роли — только для ADMIN. Нельзя снять ADMIN с себя.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="email или имя"
          className="min-w-[220px] flex-1 rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все роли</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="button" onClick={load} className="btn-primary">
          Обновить
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      <div className="overflow-x-auto rounded-brand border border-[var(--color-border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Пользователь</th>
              <th className="px-3 py-2">Роль</th>
              <th className="px-3 py-2">Бренды</th>
              <th className="px-3 py-2">Платежи</th>
              <th className="px-3 py-2">Действие</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{user.email || "—"}</p>
                  <p className="text-xs text-muted">{user.name}</p>
                </td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">{user._count.ownedBrands}</td>
                <td className="px-3 py-2">{user._count.paymentOrders}</td>
                <td className="px-3 py-2">
                  <select
                    disabled={busy}
                    defaultValue={user.role}
                    key={`${user.id}-${user.role}`}
                    onChange={(e) => setUserRole(user.id, e.target.value)}
                    className="rounded-brand border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
