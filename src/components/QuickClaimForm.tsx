"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_CATALOG,
  ENTRY_PRICE_KZT,
  TERRITORY_CELL_PRICE_KZT,
  suggestCategory,
} from "@/lib/category-catalog";
import { formatApiError } from "@/lib/format-api-error";
import { isValidKzPhone } from "@/lib/phone";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { PhoneField } from "@/components/PhoneField";
import type { CheckoutProvider } from "@/lib/payments/methods";

type Props = {
  locale?: string;
  topPlaceKzt?: number | null;
  /** Prefilled from a "take this place for X" button in the leaderboard. */
  initialCategory?: string;
  initialAmountKzt?: number;
};

type Result = {
  claimId: string;
  brandName: string;
  categoryNameRu: string;
  continentRu: string;
  amountKzt: number;
  paymentUrl?: string;
  testMode?: boolean;
  orderId?: string;
  statusToken?: string;
  provider?: CheckoutProvider | "test";
  paymentMode?: "redirect" | "kaspi_invoice";
  paymentMessage?: string;
};

/**
 * The whole purchase in one row: link, category, amount, pay.
 *
 * No account is required — the email here becomes the account, and sign-in
 * happens afterwards to manage what was bought. Character, outfit and city are
 * deliberately absent: every field in front of the payment costs conversion,
 * and none of those change what the buyer gets.
 */
export function QuickClaimForm({
  locale = "ru",
  topPlaceKzt,
  initialCategory,
  initialAmountKzt,
}: Props) {
  const validInitialCategory = CATEGORY_CATALOG.some(
    (category) => category.slug === initialCategory,
  )
    ? initialCategory
    : undefined;

  const [url, setUrl] = useState("");
  const [categorySlug, setCategorySlug] = useState<string>(
    validInitialCategory ?? "",
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<CheckoutProvider>("unicorn");
  const [amount, setAmount] = useState(
    initialAmountKzt ?? topPlaceKzt ?? ENTRY_PRICE_KZT,
  );
  // An amount arriving from a "take this place" button is already the intended
  // price, so the live top-place figure must not overwrite it.
  const [touchedAmount, setTouchedAmount] = useState(
    initialAmountKzt !== undefined,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [kaspiPaid, setKaspiPaid] = useState(false);

  const categories = useMemo(
    () =>
      CATEGORY_CATALOG.map((category) => ({
        slug: category.slug,
        label: locale === "kk" ? category.nameKk : category.nameRu,
        continent: locale === "kk" ? category.continentKk : category.continentRu,
      })),
    [locale],
  );

  // Guess the continent from the link so the buyer immediately sees where they
  // will land, instead of having to pick from 24 options cold.
  useEffect(() => {
    if (!url.trim() || categorySlug) return;
    const guess = suggestCategory(url);
    if (guess.slug !== "other") setCategorySlug(guess.slug);
  }, [url, categorySlug]);

  useEffect(() => {
    if (!touchedAmount && topPlaceKzt) setAmount(topPlaceKzt);
  }, [topPlaceKzt, touchedAmount]);

  useEffect(() => {
    if (result?.provider !== "kaspi" || !result.orderId || kaspiPaid) return;
    let cancelled = false;
    async function check() {
      const token = result!.statusToken
        ? `&token=${encodeURIComponent(result!.statusToken)}`
        : "";
      const response = await fetch(
        `/api/payments/kaspi-status?orderId=${encodeURIComponent(result!.orderId!)}${token}`,
      ).catch(() => null);
      if (!response?.ok) return;
      const status = await response.json();
      if (!cancelled && status.paid) setKaspiPaid(true);
    }
    check();
    const timer = setInterval(check, 4_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [result, kaspiPaid]);

  const selected = categories.find((c) => c.slug === categorySlug);

  function step(direction: 1 | -1) {
    setTouchedAmount(true);
    setAmount((current) =>
      Math.max(
        ENTRY_PRICE_KZT,
        current + direction * TERRITORY_CELL_PRICE_KZT,
      ),
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quick-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          categorySlug: categorySlug || undefined,
          contactEmail: email.trim(),
          amountKzt: amount,
          phone,
          provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data.error, "Не удалось создать заявку"));
      }
      setResult(data as Result);
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    url.trim().length > 3 &&
    /.+@.+\..+/.test(email) &&
    phone.replace(/\D/g, "").length >= 11 &&
    isValidKzPhone(phone) &&
    !loading;

  if (result && !result.paymentUrl) {
    return (
      <div className="surface-card space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          {kaspiPaid ? "Оплата подтверждена" : "Счёт отправлен в Kaspi"}
        </h2>
        <p className="text-sm text-muted">
          {kaspiPaid
            ? `«${result.brandName}» отправляется на материк «${result.continentRu}». После короткой проверки бренд появится на карте.`
            : result.paymentMessage}
        </p>
        <p className="text-sm text-muted">
          {kaspiPaid
            ? "Ссылка для входа в кабинет придёт на почту."
            : "Откройте приложение Kaspi и подтвердите выставленный счёт. Статус обновится автоматически."}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Займите место на планете
        </h2>
        <p className="mt-1 text-sm text-muted">
          Вставьте ссылку, выберите материк и сумму. Аккаунт не нужен — он
          создастся после оплаты.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>
          <label
            htmlFor="quick-url"
            className="block text-sm font-medium text-ink"
          >
            Ссылка на продукт
          </label>
          <input
            id="quick-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="site.kz или @handle"
            className="mt-1 h-11 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 text-sm"
          />
          <p className="mt-1 min-h-[2.5rem] text-xs leading-snug text-muted">
            Сайт, Telegram, Instagram, YouTube, App Store или Google Play
          </p>
        </div>

        <div>
          <label
            htmlFor="quick-category"
            className="block text-sm font-medium text-ink"
          >
            Материк
          </label>
          <select
            id="quick-category"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="mt-1 h-11 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">Определить по ссылке</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label} · {category.continent}
              </option>
            ))}
          </select>
          <p className="mt-1 min-h-[2.5rem] text-xs leading-snug text-[var(--color-accent)]">
            {selected ? `→ материк «${selected.continent}»` : "\u00a0"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>
          <label
            htmlFor="quick-email"
            className="block text-sm font-medium text-ink"
          >
            Email для чека и доступа
          </label>
          <input
            id="quick-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.kz"
            className="mt-1 h-11 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 text-sm"
          />
          <p className="mt-1 min-h-[2.5rem] text-xs leading-snug text-muted">
            Чек и ссылка в личный кабинет
          </p>
        </div>

        <PhoneField
          id="quick-phone"
          value={phone}
          onChange={setPhone}
          label="Телефон для оплаты"
          hint="Формат: +7 705 111 22 40 — для Kaspi номер из приложения"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>
          <span className="block text-sm font-medium text-ink">Способ оплаты</span>
          <div className="mt-1">
            <PaymentMethodPicker value={provider} onChange={setProvider} />
          </div>
          <p className="mt-1 min-h-[2.5rem] text-xs leading-snug text-muted">
            Visa, Mastercard или счёт в Kaspi
          </p>
        </div>

        <div>
          <span className="block text-sm font-medium text-ink">Сумма</span>
          <div className="mt-1 flex h-11 items-stretch rounded-brand border border-[var(--color-border)] bg-white">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Уменьшить сумму"
              className="flex w-11 shrink-0 items-center justify-center text-lg text-muted hover:text-ink"
            >
              −
            </button>
            <span className="flex flex-1 items-center justify-center font-display text-base font-semibold tabular-nums text-ink">
              {amount.toLocaleString("ru-KZ")} ₸
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Увеличить сумму"
              className="flex w-11 shrink-0 items-center justify-center text-lg text-muted hover:text-ink"
            >
              +
            </button>
          </div>
          <p className="mt-1 min-h-[2.5rem] text-xs leading-snug text-muted">
            Шаг {TERRITORY_CELL_PRICE_KZT.toLocaleString("ru-KZ")} ₸
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-brand bg-[var(--color-surface-soft)] px-3 py-2 text-sm text-[var(--color-primary)]">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Готовим оплату…"
          : `Занять место за ${amount.toLocaleString("ru-KZ")} ₸`}
      </button>

      <p className="text-xs text-muted">
        Позиция определяется оплаченной суммой, а не оценкой качества бренда.
        Персонажа и оформление настроите после оплаты.
      </p>
    </div>
  );
}
