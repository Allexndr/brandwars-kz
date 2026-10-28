"use client";

import { useEffect, useState } from "react";
import { formatApiError } from "@/lib/format-api-error";

type Profile = {
  kind: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  bin: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
};

/**
 * Legal details for the invoice.
 *
 * Placed after payment on purpose: asking a buyer for a БИН before checkout
 * adds friction to the one step that must stay short, and the document can be
 * issued at any point once the details arrive.
 */
export function BillingProfileForm() {
  const [kind, setKind] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [companyName, setCompanyName] = useState("");
  const [bin, setBin] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/billing-profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { profile: null }))
      .then((data: { profile: Profile | null }) => {
        if (!alive || !data.profile) return;
        const p = data.profile;
        setKind(p.kind);
        setCompanyName(p.companyName ?? "");
        setBin(p.bin ?? "");
        setAddress(p.address ?? "");
        setContactName(p.contactName ?? "");
        setContactPhone(p.contactPhone ?? "");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/billing-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          companyName: companyName.trim() || undefined,
          bin: bin.trim() || undefined,
          address: address.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Не удалось сохранить"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const isCompany = kind === "COMPANY";
  const canSave = !saving && (!isCompany || (companyName.trim() && bin.trim().length === 12));

  return (
    <section className="surface-card space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Реквизиты для документов
        </h2>
        <p className="mt-1 text-sm text-muted">
          Нужны, чтобы в счёте и акте стояли ваши данные. Без них бухгалтер не
          проведёт расход.
        </p>
      </div>

      <div className="flex gap-1 rounded-brand bg-[var(--color-surface-soft)] p-1">
        {(
          [
            { id: "INDIVIDUAL" as const, label: "Физлицо / ИП" },
            { id: "COMPANY" as const, label: "Юрлицо (ТОО)" },
          ]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKind(option.id)}
            className={`flex-1 rounded-brand px-3 py-1.5 text-sm font-medium transition ${
              kind === option.id
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isCompany && (
          <div className="sm:col-span-2">
            <label htmlFor="bp-company" className="block text-sm font-medium text-ink">
              Название организации <span className="text-[var(--color-primary)]">*</span>
            </label>
            <input
              id="bp-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder='ТОО "Пример"'
              className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label htmlFor="bp-bin" className="block text-sm font-medium text-ink">
            БИН / ИИН {isCompany && <span className="text-[var(--color-primary)]">*</span>}
          </label>
          <input
            id="bp-bin"
            value={bin}
            inputMode="numeric"
            maxLength={12}
            onChange={(e) => setBin(e.target.value.replace(/\D/g, ""))}
            placeholder="12 цифр"
            className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm tabular-nums"
          />
          {bin.length > 0 && bin.length !== 12 && (
            <p className="mt-1 text-xs text-[var(--color-primary)]">
              Должно быть 12 цифр
            </p>
          )}
        </div>

        <div>
          <label htmlFor="bp-phone" className="block text-sm font-medium text-ink">
            Телефон
          </label>
          <input
            id="bp-phone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+7 ___ ___ __ __"
            className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bp-address" className="block text-sm font-medium text-ink">
            Адрес
          </label>
          <input
            id="bp-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="г. Алматы, ул. ..."
            className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bp-contact" className="block text-sm font-medium text-ink">
            {isCompany ? "Подписант / контактное лицо" : "ФИО"}
          </label>
          <input
            id="bp-contact"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-brand bg-[var(--color-surface-soft)] px-3 py-2 text-sm text-[var(--color-primary)]">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Сохраняем…" : saved ? "Сохранено" : "Сохранить реквизиты"}
      </button>
    </section>
  );
}
