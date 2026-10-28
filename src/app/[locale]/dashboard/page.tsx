"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { formatApiError } from "@/lib/format-api-error";
import { BillingProfileForm } from "@/components/BillingProfileForm";
import { DocumentsList } from "@/components/DocumentsList";
import { BrandEarningsPanel } from "@/components/BrandEarningsPanel";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { PhoneField } from "@/components/PhoneField";
import { isValidKzPhone } from "@/lib/phone";
import type { CheckoutProvider } from "@/lib/payments/methods";
import { CosmeticsSection } from "@/components/CosmeticsSection";
import { AgencyOverview } from "@/components/AgencyOverview";

function DashboardInner() {
  const { data: session } = useSession();
  const t = useTranslations("dashboard");
  const searchParams = useSearchParams();
  const [amount, setAmount] = useState(500);
  const [brandId, setBrandId] = useState<string | undefined>();
  const [purpose, setPurpose] = useState<"support" | "top_up">("top_up");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<CheckoutProvider>("unicorn");
  const [kaspiOrderId, setKaspiOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const topUp = searchParams.get("topUp");
    const brand = searchParams.get("brandId");
    const supportFlag = searchParams.get("support");
    if (topUp && Number(topUp) > 0) setAmount(Number(topUp));
    if (brand) {
      setBrandId(brand);
      setPurpose(supportFlag === "0" ? "top_up" : "support");
    }
    if (searchParams.get("paid") === "1") {
      setMessage(
        purpose === "support" || brand
          ? "Оплата принята. Сила бренда и доля бренду (80%) появятся после webhook."
          : "Оплата принята. Сила поддержки обновится после подтверждения webhook.",
      );
    }
  }, [searchParams, purpose]);

  useEffect(() => {
    if (!kaspiOrderId) return;
    let cancelled = false;
    async function check() {
      const response = await fetch(
        `/api/payments/kaspi-status?orderId=${encodeURIComponent(kaspiOrderId!)}`,
      ).catch(() => null);
      if (!response?.ok) return;
      const status = await response.json();
      if (!cancelled && status.paid) {
        setMessage("Оплата Kaspi подтверждена.");
        setKaspiOrderId(null);
      }
    }
    check();
    const timer = setInterval(check, 4_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [kaspiOrderId]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKzt: amount,
          brandId,
          phone,
          provider,
          purpose: brandId ? purpose : "top_up",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Ошибка оплаты"));

      if (data.paymentUrl && !data.testMode) {
        window.location.href = data.paymentUrl;
        return;
      }
      if (data.mode === "kaspi_invoice") {
        setKaspiOrderId(data.order.id);
        setMessage(data.message ?? "Счёт отправлен в Kaspi.");
        return;
      }

      setMessage(
        data.testMode
          ? `Тестовый заказ ${data.order.id}. В проде откроется оплата.`
          : `Заказ создан: ${data.order.id}`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
      <p className="text-muted">{session?.user?.email ?? session?.user?.name ?? "Пользователь"}</p>

      <BrandEarningsPanel />

      <div className="surface-card">
        <h2 className="font-semibold text-ink">
          {brandId && purpose === "support" ? "Поддержать бренд" : t("topUp")}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {brandId && purpose === "support"
            ? "80% уходит на счёт бренда, 20% — платформе. Сила на карте растёт на всю сумму."
            : "Оплата банковской картой или счётом в Kaspi. Сила поддержки растёт только после подтверждённого платежа."}
        </p>
        <form onSubmit={handleTopUp} className="mt-4 space-y-3">
          <label className="block text-sm text-ink">
            {t("amount")}
            <input
              type="number"
              min={500}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input-field mt-1"
            />
          </label>
          <PhoneField
            id="dash-phone"
            value={phone}
            onChange={setPhone}
            label="Телефон"
            inputClassName="input-field mt-1"
            hint="Формат: +7 705 111 22 40"
          />
          <PaymentMethodPicker value={provider} onChange={setProvider} />
          <button
            type="submit"
            disabled={loading || !isValidKzPhone(phone)}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "..."
              : provider === "kaspi"
                ? "Выставить счёт в Kaspi"
                : "Оплатить картой"}
          </button>
        </form>
        {message && <p className="mt-3 text-sm text-accent">{message}</p>}
      </div>

      <AgencyOverview />
      <CosmeticsSection />
      <BillingProfileForm />
      <DocumentsList />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}
