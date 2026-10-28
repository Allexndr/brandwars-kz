"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { signIn, useSession } from "next-auth/react";
import { formatApiError } from "@/lib/format-api-error";
import { normalizeWebsiteUrl } from "@/lib/normalize-url";
import {
  CATEGORY_CATALOG,
  ENTRY_PRICE_KZT,
  TERRITORY_CELL_PRICE_KZT,
  suggestCategory,
} from "@/lib/category-catalog";
import { SCOPE_CATALOG } from "@/lib/scopes";
import { CharacterStudio } from "@/components/CharacterStudio";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { PhoneField } from "@/components/PhoneField";
import { isValidKzPhone } from "@/lib/phone";
import type { Costume } from "@/lib/character-sprites";
import type { CheckoutProvider } from "@/lib/payments/methods";

type Metadata = {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
};

export function ClaimWizard({ initialCategory }: { initialCategory?: string }) {
  const t = useTranslations("claim");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { data: session, status } = useSession();
  const categories = useMemo(
    () =>
      CATEGORY_CATALOG.map((category) => ({
        ...category,
        label: locale === "kk" ? category.nameKk : category.nameRu,
        continent: locale === "kk" ? category.continentKk : category.continentRu,
      })),
    [locale],
  );
  const cities = useMemo(
    () =>
      SCOPE_CATALOG.filter((scope) => scope.kind === "CITY").map((scope) => ({
        slug: scope.slug,
        name: locale === "kk" ? scope.nameKk : scope.nameRu,
      })),
    [locale],
  );

  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [brandName, setBrandName] = useState("");
  const validInitialCategory =
    initialCategory && CATEGORY_CATALOG.some((category) => category.slug === initialCategory)
      ? initialCategory
      : null;
  const [categorySlug, setCategorySlug] = useState(validInitialCategory ?? "travel");
  const [suggestedCategorySlug, setSuggestedCategorySlug] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentProvider, setPaymentProvider] = useState<CheckoutProvider>("unicorn");
  const [cityScopeSlug, setCityScopeSlug] = useState("kz-almaty");
  const [bidAmount, setBidAmount] = useState(ENTRY_PRICE_KZT);
  const [representativeName, setRepresentativeName] = useState("");
  const [characterType, setCharacterType] = useState("guide");
  const [outfitColor, setOutfitColor] = useState("#C2410C");
  const [costume, setCostume] = useState<Costume | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [kaspiOrderId, setKaspiOrderId] = useState<string | null>(null);
  const [kaspiPaid, setKaspiPaid] = useState(false);

  const selectedCategory = categories.find((category) => category.slug === categorySlug);

  useEffect(() => {
    if (!kaspiOrderId || kaspiPaid) return;
    let cancelled = false;
    async function check() {
      const response = await fetch(
        `/api/payments/kaspi-status?orderId=${encodeURIComponent(kaspiOrderId!)}`,
      ).catch(() => null);
      if (!response?.ok) return;
      const status = await response.json();
      if (!cancelled && status.paid) {
        setKaspiPaid(true);
        setDone(true);
      }
    }
    check();
    const timer = setInterval(check, 4_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [kaspiOrderId, kaspiPaid]);

  async function fetchMetadataAndContinue() {
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizeWebsiteUrl(url);
      const res = await fetch("/api/brands/metadata-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Не удалось загрузить сайт"));
      setUrl(normalized);
      setMetadata(data);
      if (data.title) setBrandName(data.title);
      const suggestion = suggestCategory(
        [normalized, data.title, data.description].filter(Boolean).join(" "),
      );
      const nextCategory =
        validInitialCategory
          ? validInitialCategory
          : suggestion.slug;
      setCategorySlug(nextCategory);
      setSuggestedCategorySlug(validInitialCategory ? null : suggestion.slug);
      setBidAmount(ENTRY_PRICE_KZT);
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
          websiteUrl: normalizeWebsiteUrl(url),
          brandName,
          categorySlug,
          contactEmail,
          bidAmountKzt: bidAmount,
          metadata: {
            ...(metadata ?? {}),
            representativeName: representativeName || brandName,
            characterType,
            outfitColor,
            costume,
            cityScopeSlug,
          },
        }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok) {
        throw new Error(formatApiError(claimData.error, "Не удалось создать заявку"));
      }

      const payRes = await fetch("/api/dashboard/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKzt: bidAmount,
          claimId: claimData.claim.id,
          phone,
          provider: paymentProvider,
          idempotencyKey: `claim_${claimData.claim.id}`,
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        throw new Error(formatApiError(payData.error, "Не удалось создать оплату"));
      }

      // Lemon Squeezy / hosted checkout — Card + Google Pay
      if (payData.paymentUrl && !payData.testMode) {
        window.location.href = payData.paymentUrl;
        return;
      }

      if (payData.mode === "kaspi_invoice" && payData.order?.id) {
        setKaspiOrderId(payData.order.id);
        return;
      }

      if (payData.testMode && payData.order?.providerOrderId) {
        const confirmRes = await fetch("/api/payments/confirm-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerOrderId: payData.order.providerOrderId,
            orderId: payData.order.id,
          }),
        });
        if (!confirmRes.ok) throw new Error("Не удалось подтвердить тестовую оплату");
      }

      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (kaspiOrderId && !kaspiPaid) {
    return (
      <div className="surface-card border-l-4 border-l-[#f14635] text-center">
        <p className="font-display text-xl font-semibold text-ink">
          Счёт отправлен в Kaspi
        </p>
        <p className="mt-2 text-sm text-muted">
          Откройте Kaspi, подтвердите счёт и не закрывайте страницу — статус
          обновится автоматически.
        </p>
        <div className="mx-auto mt-5 h-2 w-40 overflow-hidden rounded-full bg-black/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#f14635]" />
        </div>
      </div>
    );
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
            type="text"
            inputMode="url"
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
          {suggestedCategorySlug && selectedCategory && (
            <div className="rounded-brand bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <span className="font-semibold">Мы предлагаем:</span>{" "}
              {selectedCategory.label} → материк «{selectedCategory.continent}».
              Можно выбрать другую сферу ниже.
            </div>
          )}
          <select
            value={categorySlug}
            onChange={(e) => {
              setCategorySlug(e.target.value);
              setSuggestedCategorySlug(null);
              setBidAmount(ENTRY_PRICE_KZT);
            }}
            className="input-field"
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label} · {category.continent} — {ENTRY_PRICE_KZT.toLocaleString("ru-KZ")} ₸
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
          <PhoneField
            id="claim-phone"
            value={phone}
            onChange={setPhone}
            inputClassName="input-field"
            hint="Формат: +7 705 111 22 40"
          />
          <PaymentMethodPicker value={paymentProvider} onChange={setPaymentProvider} />
          <label className="block text-sm font-medium text-ink">
            Город бренда
            <select
              value={cityScopeSlug}
              onChange={(e) => setCityScopeSlug(e.target.value)}
              className="input-field mt-1"
            >
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted">
              Городской рейтинг откроется, когда соберётся достаточно местных брендов.
            </span>
          </label>
          <CharacterStudio
            logoUrl={metadata?.favicon ?? metadata?.ogImage ?? null}
            brandName={brandName}
            categorySlug={categorySlug}
            defaultName={representativeName || brandName}
            onChange={(config) => {
              setRepresentativeName(config.representativeName);
              setCharacterType(config.characterType);
              setOutfitColor(config.outfitColor);
              setCostume(config.costume);
            }}
          />
          <div>
            <label className="text-sm font-medium text-ink">{t("bidLabel")}</label>
            <input
              type="number"
              value={bidAmount}
              min={ENTRY_PRICE_KZT}
              step={TERRITORY_CELL_PRICE_KZT}
              onChange={(e) => setBidAmount(Number(e.target.value))}
              className="input-field mt-1"
            />
            <p className="mt-1 text-xs text-muted">
              Размещение — 1 000 ₸. Каждый следующий шаг 500 ₸ расширяет территорию на одну клетку.
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">
              {tc("back")}
            </button>
            <button
              type="button"
              disabled={
                !brandName ||
                !contactEmail ||
                phone.replace(/\D/g, "").length < 11 ||
                !isValidKzPhone(phone)
              }
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
          <p className="text-xs text-muted">
            {t("refundNote")} Оплата через Lemon Squeezy: карта, Google Pay, Apple Pay, PayPal.
          </p>

          {status === "loading" ? (
            <p className="text-sm text-muted">{tc("loading")}</p>
          ) : !session?.user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t("loginRequired")}</p>
              <button
                type="button"
                onClick={() => signIn(undefined, { callbackUrl: "/ru/claim-brand" })}
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
                {loading
                  ? tc("loading")
                  : t("payCta", { amount: bidAmount.toLocaleString("ru-KZ") })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
