"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { signIn, useSession } from "next-auth/react";

const CATEGORIES = [
  { slug: "travel", label: "Travelia", min: 2000 },
  { slug: "beauty", label: "Beauty Republic", min: 2000 },
  { slug: "code", label: "Codeverse", min: 1500 },
  { slug: "ai-agents", label: "Agentoria", min: 1500 },
  { slug: "games", label: "Game Islands", min: 1500 },
  { slug: "marketing", label: "Marketland", min: 2000 },
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
  const { data: session, status } = useSession();

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

  async function fetchMetadataAndContinue() {
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

  async function submitAndPay() {
    if (!session?.user) {
      setError(t("loginRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const claimRes = await fetch("/api/brand-claims", {
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
      const claimData = await claimRes.json();
      if (!claimRes.ok) throw new Error(JSON.stringify(claimData.error));

      const payRes = await fetch("/api/dashboard/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKzt: bidAmount,
          idempotencyKey: `claim_${claimData.claim.id}`,
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(JSON.stringify(payData.error));

      if (payData.testMode && payData.order?.providerOrderId) {
        const confirmRes = await fetch("/api/payments/confirm-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerOrderId: payData.order.providerOrderId,
            orderId: payData.order.id,
          }),
        });
        if (!confirmRes.ok) throw new Error("Payment confirm failed");
      }

      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="surface-card border-l-4 border-l-accent text-center">
        <p className="font-display text-xl font-semibold text-ink">{t("successPaid")}</p>
        <p className="mt-2 text-sm text-muted">{t("successModeration")}</p>
        <button
          type="button"
          onClick={() => router.push("/map")}
          className="btn-primary mt-6"
        >
          {t("goMap")}
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card">
      {/* Progress: 3 steps only */}
      <div className="mb-8 flex items-center gap-3">
        {[
          { n: 1, label: t("flowLink") },
          { n: 2, label: t("flowDetails") },
          { n: 3, label: t("flowPay") },
        ].map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center gap-2">
            <span
              className={`step-dot ${step > s.n ? "step-dot-done" : step === s.n ? "step-dot-active" : "step-dot-pending"}`}
            >
              {s.n}
            </span>
            <span className="hidden text-xs font-medium text-muted sm:inline">{s.label}</span>
            {i < 2 && <div className="h-px flex-1 bg-[var(--color-border)]" />}
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-brand bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("step1")}</h2>
          <p className="text-sm text-muted">{t("step1hint")}</p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("urlPlaceholder")}
            className="input-field"
          />
          <button
            type="button"
            disabled={!url || loading}
            onClick={fetchMetadataAndContinue}
            className="btn-primary"
          >
            {loading ? tc("loading") : tc("next")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("flowDetails")}</h2>
          {metadata && (
            <div className="flex gap-4 rounded-brand bg-[var(--color-surface-soft)] p-4">
              {metadata.ogImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={metadata.ogImage} alt="" className="h-16 w-16 rounded object-cover" />
              )}
              <div>
                <p className="font-medium">{metadata.title}</p>
                <p className="line-clamp-2 text-sm text-muted">{metadata.description}</p>
              </div>
            </div>
          )}
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder={t("brandNamePlaceholder")}
            className="input-field"
          />
          <select
            value={categorySlug}
            onChange={(e) => {
              setCategorySlug(e.target.value);
              const cat = CATEGORIES.find((c) => c.slug === e.target.value);
              if (cat) setBidAmount(cat.min);
            }}
            className="input-field"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label} — от {c.min.toLocaleString("ru-KZ")} ₸
              </option>
            ))}
          </select>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="input-field"
          />
          <div>
            <label className="text-sm font-medium text-ink">{t("bidLabel")}</label>
            <input
              type="number"
              value={bidAmount}
              min={selectedCategory?.min ?? 1500}
              step={500}
              onChange={(e) => setBidAmount(Number(e.target.value))}
              className="input-field mt-1"
            />
            <p className="mt-1 text-xs text-muted">{t("bidHint")}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">
              {tc("back")}
            </button>
            <button
              type="button"
              disabled={!brandName || !contactEmail}
              onClick={() => setStep(3)}
              className="btn-primary"
            >
              {t("toPayment")}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">{t("flowPay")}</h2>
          <dl className="space-y-2 rounded-brand bg-[var(--color-surface-soft)] p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Бренд</dt>
              <dd className="font-medium">{brandName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Категория</dt>
              <dd>{selectedCategory?.label}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-2">
              <dt className="font-semibold text-ink">К оплате</dt>
              <dd className="font-display text-xl font-semibold text-primary">
                {bidAmount.toLocaleString("ru-KZ")} ₸
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted">{t("refundNote")}</p>

          {status === "loading" ? (
            <p className="text-sm text-muted">{tc("loading")}</p>
          ) : !session?.user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t("loginRequired")}</p>
              <button
                type="button"
                onClick={() =>
                  signIn(undefined, { callbackUrl: "/claim-brand" })
                }
                className="btn-primary w-full"
              >
                {t("loginToPay")}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                {tc("back")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={submitAndPay}
                className="btn-primary flex-1"
              >
                {loading ? tc("loading") : t("payCta", { amount: bidAmount.toLocaleString("ru-KZ") })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
