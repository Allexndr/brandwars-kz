"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { moneyKzt, providerLabel } from "@/lib/payments/methods";

type Detail = {
  order: {
    id: string;
    amountKzt: number;
    status: string;
    paymentProvider: string;
    providerOrderId: string | null;
    idempotencyKey: string;
    checkoutUrl: string | null;
    metadata: unknown;
    appliedAt: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
      role: string;
      billingProfile: {
        kind: string;
        companyName: string | null;
        bin: string | null;
        address: string | null;
        contactName: string | null;
        contactPhone: string | null;
        email: string | null;
      } | null;
      wallet: { balance: number } | null;
    };
    brand: {
      id: string;
      name: string;
      slug: string;
      websiteUrl: string | null;
      verificationStatus: string;
    } | null;
    brandClaim: {
      id: string;
      brandName: string;
      websiteUrl: string;
      status: string;
      bidAmountKzt: number;
      contactEmail: string;
      moderation: { id: string; status: string; notes: string | null } | null;
    } | null;
    transaction: {
      id: string;
      type: string;
      status: string;
      amountKzt: number;
      paymentProvider: string | null;
    } | null;
    invoice: {
      id: string;
      number: number;
      payerName: string;
      payerBin: string | null;
      description: string;
      issuedAt: string;
      actIssuedAt: string | null;
    } | null;
  };
  timeline: Array<{ at: string; kind: string; title: string; detail: string }>;
};

export default function AdminPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load() {
    if (!params.id) return;
    const res = await fetch(`/api/admin/payments/${params.id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Не найдено");
    setData(json);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [params.id]);

  async function act(action: "apply" | "mark_failed") {
    if (!params.id) return;
    setBusy(true);
    setActionMsg(null);
    setError(null);
    const res = await fetch(`/api/admin/payments/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Ошибка");
      return;
    }
    setActionMsg(action === "apply" ? "Оплата применена" : "Помечено как failed");
    await load().catch(() => undefined);
  }

  if (error && !data) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-muted">Загрузка...</p>;

  const { order, timeline } = data;
  const billing = order.user.billingProfile;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/payments" className="text-sm text-muted hover:underline">
          ← Все платежи
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          Платёж {moneyKzt(order.amountKzt)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {providerLabel(order.paymentProvider)} · {order.status} · {order.id}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || Boolean(order.appliedAt)}
          onClick={() => act("apply")}
          className="rounded-brand bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Применить оплату
        </button>
        <button
          type="button"
          disabled={busy || Boolean(order.appliedAt && order.status === "PAID")}
          onClick={() => act("mark_failed")}
          className="rounded-brand border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Пометить failed
        </button>
        {actionMsg ? <span className="text-sm text-emerald-700">{actionMsg}</span> : null}
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm">
          <h2 className="font-semibold text-ink">Реквизиты платежа</h2>
          <p>Idempotency: {order.idempotencyKey}</p>
          <p>Provider order: {order.providerOrderId || "—"}</p>
          <p>Создан: {new Date(order.createdAt).toLocaleString("ru-KZ")}</p>
          <p>Applied: {order.appliedAt ? new Date(order.appliedAt).toLocaleString("ru-KZ") : "нет"}</p>
          {order.checkoutUrl ? (
            <p className="break-all">
              Checkout:{" "}
              <a href={order.checkoutUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                открыть
              </a>
            </p>
          ) : null}
          {order.metadata ? (
            <pre className="overflow-x-auto rounded bg-black/[0.04] p-2 text-xs">
              {JSON.stringify(order.metadata, null, 2)}
            </pre>
          ) : null}
        </section>

        <section className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm">
          <h2 className="font-semibold text-ink">Клиент / компания</h2>
          <p>
            <Link
              href={`/admin/companies/${order.user.email || order.user.id}`}
              className="font-medium hover:underline"
            >
              {order.user.name || order.user.email}
            </Link>
          </p>
          <p>Роль: {order.user.role}</p>
          <p>Кошелёк: {order.user.wallet ? moneyKzt(order.user.wallet.balance) : "—"}</p>
          {billing ? (
            <>
              <p className="pt-2 font-medium">
                {billing.kind === "COMPANY" ? "Юрлицо" : "Физлицо"}:{" "}
                {billing.companyName || billing.contactName || "—"}
              </p>
              <p>БИН/ИИН: {billing.bin || "—"}</p>
              <p>Адрес: {billing.address || "—"}</p>
              <p>Контакт: {billing.contactPhone || billing.email || "—"}</p>
            </>
          ) : (
            <p className="text-muted">Биллинг-профиль не заполнен</p>
          )}
        </section>

        <section className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm">
          <h2 className="font-semibold text-ink">Связанные объекты</h2>
          {order.brandClaim ? (
            <p>
              Заявка «{order.brandClaim.brandName}» · {order.brandClaim.status} ·{" "}
              {order.brandClaim.websiteUrl}
            </p>
          ) : null}
          {order.brand ? (
            <p>
              Бренд{" "}
              <Link href={`/admin/brands/${order.brand.id}`} className="hover:underline">
                {order.brand.name}
              </Link>{" "}
              · {order.brand.verificationStatus}
            </p>
          ) : null}
          {order.transaction ? (
            <p>
              Транзакция {order.transaction.type} · {order.transaction.status} ·{" "}
              {moneyKzt(order.transaction.amountKzt)}
            </p>
          ) : (
            <p className="text-muted">Внутренней транзакции ещё нет</p>
          )}
          {order.invoice ? (
            <p>
              Счёт №{order.invoice.number} · {order.invoice.payerName}
              {order.invoice.actIssuedAt ? " · акт выдан" : ""}
            </p>
          ) : null}
        </section>

        <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-4 text-sm">
          <h2 className="font-semibold text-ink">Таймлайн процесса</h2>
          <ol className="space-y-3">
            {timeline.map((step, index) => (
              <li key={`${step.kind}-${index}`} className="border-l-2 border-ink/20 pl-3">
                <p className="text-xs text-muted">
                  {new Date(step.at).toLocaleString("ru-KZ")} · {step.kind}
                </p>
                <p className="font-medium text-ink">{step.title}</p>
                <p className="text-muted">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
