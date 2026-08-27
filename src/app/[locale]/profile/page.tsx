"use client";

import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Профиль</h1>
      {session?.user ? (
        <dl className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{session.user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Имя</dt>
            <dd>{session.user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Роль</dt>
            <dd>{session.user.role}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-slate-400">Не авторизован</p>
      )}
    </div>
  );
}
