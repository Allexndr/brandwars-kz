"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

const CATEGORIES = [
  { slug: "travel", min: 2000 },
  { slug: "beauty", min: 2000 },
  { slug: "code", min: 1500 },
  { slug: "ai-agents", min: 1500 },
  { slug: "games", min: 1500 },
  { slug: "marketing", min: 2000 },
];

type Metadata = {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
};

export function ClaimWizard() {
  const t = useTranslations("claim");
  const tc = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [brandName, setBrandName] = useState("");
  const [categorySlug, setCategorySlug] = useState("travel");
  const [contactEmail, setContactEmail] = useState("");
  const [bidAmount, setBidAmount] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedCategory = CATEGORIES.find((c) => c.slug === categorySlug);

  async function fetchMetadata() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brands/metadata-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fetch failed");
      setMetadata(data);
      if (data.title) setBrandName(data.title);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function submitClaim() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: url,
          brandName,
          categorySlug,
          contactEmail,
          bidAmountKzt: bidAmount,
          metadata: metadata ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-6 text-center">
        <p className="text-lg text-emerald-300">{t("success")}</p>
        <button
          type="button"
          onClick={() => router.push("/brands")}
          className="mt-4 rounded bg-sky-600 px-4 py-2 text-sm hover:bg-sky-500"
        >
          {tc("learnMore")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-6 flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded ${s <= step ? "bg-sky-500" : "bg-slate-700"}`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("step1")}</h2>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("urlPlaceholder")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <button
            type="button"
            disabled={!url || loading}
            onClick={fetchMetadata}
            className="rounded bg-sky-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? tc("loading") : tc("next")}
          </button>
        </div>
      )}

      {step === 2 && metadata && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("step2")}</h2>
          <div className="flex gap-4 rounded-lg border border-slate-700 p-4">
            {metadata.ogImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metadata.ogImage}
                alt=""
                className="h-20 w-20 rounded object-cover"
              />
            )}
            <div>
              <p className="font-medium">{metadata.title}</p>
              <p className="text-sm text-slate-400">{metadata.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded border border-slate-600 px-4 py-2 text-sm">
              {tc("back")}
            </button>
            <button type="button" onClick={() => setStep(3)} className="rounded bg-sky-600 px-4 py-2 text-sm">
              {tc("next")}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("step3")}</h2>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Brand name"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <select
            value={categorySlug}
            onChange={(e) => {
              setCategorySlug(e.target.value);
              const cat = CATEGORIES.find((c) => c.slug === e.target.value);
              if (cat) setBidAmount(cat.min);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.slug} (min {c.min} ₸)
              </option>
            ))}
          </select>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="email@company.kz"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded border border-slate-600 px-4 py-2 text-sm">
              {tc("back")}
            </button>
            <button type="button" onClick={() => setStep(4)} className="rounded bg-sky-600 px-4 py-2 text-sm">
              {tc("next")}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("step4")}</h2>
          <p className="text-sm text-slate-400">
            Минимум: {selectedCategory?.min ?? 2000} ₸. Рейтинг отражает игровую метрику BrandWars.
          </p>
          <input
            type="number"
            value={bidAmount}
            min={selectedCategory?.min ?? 2000}
            onChange={(e) => setBidAmount(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(3)} className="rounded border border-slate-600 px-4 py-2 text-sm">
              {tc("back")}
            </button>
            <button type="button" onClick={() => setStep(5)} className="rounded bg-sky-600 px-4 py-2 text-sm">
              {tc("next")}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("step5")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">URL</dt><dd>{url}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Бренд</dt><dd>{brandName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Категория</dt><dd>{categorySlug}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Ставка</dt><dd>{bidAmount} ₸</dd></div>
          </dl>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(4)} className="rounded border border-slate-600 px-4 py-2 text-sm">
              {tc("back")}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={submitClaim}
              className="rounded bg-emerald-600 px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? tc("loading") : tc("submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
