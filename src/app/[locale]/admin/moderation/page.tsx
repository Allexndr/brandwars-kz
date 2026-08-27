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

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">{t("moderation")}</h1>
      {cases.length === 0 ? (
        <p className="text-muted">Нет открытых заявок</p>
      ) : (
        <ul className="space-y-4">
          {cases.map((c) => (
            <li key={c.id} className="surface-card">
              <p className="font-semibold text-ink">{c.brandClaim.brandName}</p>
              <p className="text-sm text-muted">{c.brandClaim.websiteUrl}</p>
              <p className="text-sm text-ink">
                {c.brandClaim.bidAmountKzt} ₸ · {c.brandClaim.contactEmail}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(c.id, "approve")}
                  className="rounded-[var(--radius-sm)] bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                >
                  {t("approve")}
                </button>
                <button
                  type="button"
                  onClick={() => act(c.id, "reject")}
                  className="rounded-[var(--radius-sm)] bg-red-100 px-3 py-1.5 text-sm text-red-700 hover:bg-red-200"
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
