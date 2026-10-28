"use client";

import type { CheckoutProvider } from "@/lib/payments/methods";

type Props = {
  value: CheckoutProvider;
  onChange: (value: CheckoutProvider) => void;
  className?: string;
};

/** Buyer-facing rails: card (= Unicorn under the hood) + Kaspi. */
const OPTIONS: Array<{ id: CheckoutProvider; label: string; active: string }> = [
  { id: "unicorn", label: "Карта", active: "bg-ink text-white" },
  { id: "kaspi", label: "Kaspi", active: "bg-[#f14635] text-white" },
];

export function PaymentMethodPicker({ value, onChange, className }: Props) {
  const current =
    value === "card" || value === "prodamus" ? "unicorn" : value === "kaspi" ? "kaspi" : "unicorn";

  return (
    <div
      className={`grid h-11 grid-cols-2 gap-1 rounded-brand border border-[var(--color-border)] bg-white p-1 ${className ?? ""}`}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`h-full rounded-[calc(var(--radius-md)-4px)] px-2 text-sm font-semibold ${
            current === option.id ? option.active : "text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
