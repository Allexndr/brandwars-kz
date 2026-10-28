"use client";

import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Профиль</h1>
      {session?.user ? (
        <dl className="surface-card space-y-3 text-sm">
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="text-ink">{session.user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Имя</dt>
            <dd className="text-ink">{session.user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Роль</dt>
            <dd className="text-ink">{session.user.role}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted">Не авторизован</p>
      )}
    </div>
  );
}
