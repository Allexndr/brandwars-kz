"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ModerationCase = {
  id: string;
  status: string;
  brandClaim: {
    id: string;
    brandName: string;
    websiteUrl: string;
    bidAmountKzt: number;
    contactEmail: string;
  };
};

export default function AdminModerationPage() {
  const t = useTranslations("admin");
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/moderation");
    const data = await res.json();
    if (res.ok) setCases(data.cases ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    await fetch(`/api/admin/moderation/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  if (loading) return <p className="text-slate-400">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("moderation")}</h1>
      {cases.length === 0 ? (
        <p className="text-slate-400">Нет открытых заявок</p>
      ) : (
        <ul className="space-y-4">
          {cases.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <p className="font-semibold">{c.brandClaim.brandName}</p>
              <p className="text-sm text-slate-400">{c.brandClaim.websiteUrl}</p>
              <p className="text-sm">
                {c.brandClaim.bidAmountKzt} ₸ · {c.brandClaim.contactEmail}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(c.id, "approve")}
                  className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600"
                >
                  {t("approve")}
                </button>
                <button
                  type="button"
                  onClick={() => act(c.id, "reject")}
                  className="rounded bg-red-900 px-3 py-1 text-sm hover:bg-red-800"
                >
                  {t("reject")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
