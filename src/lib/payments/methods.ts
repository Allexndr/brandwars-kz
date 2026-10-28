import { z } from "zod";

/** Buyer-facing checkout rails. `card` keeps the old alias → Prodamus by default. */
export const CHECKOUT_PROVIDERS = [
  "card",
  "prodamus",
  "unicorn",
  "kaspi",
] as const;

export type CheckoutProvider = (typeof CHECKOUT_PROVIDERS)[number];

export const checkoutProviderSchema = z.enum(CHECKOUT_PROVIDERS);

export function normalizeCheckoutProvider(
  value?: string | null,
): CheckoutProvider {
  const raw = String(value || "card").toLowerCase();
  if (raw === "payproverka") return "kaspi";
  if (raw === "proeducation") return "prodamus";
  if ((CHECKOUT_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as CheckoutProvider;
  }
  return "card";
}

export function providerLabel(provider: string): string {
  switch (provider) {
    case "unicorn":
    case "card":
      return "Карта";
    case "prodamus":
      return "Prodamus (карта)";
    case "kaspi":
    case "payproverka":
      return "Kaspi";
    case "wallet":
      return "Кошелёк";
    case "test":
      return "Тест";
    case "lemonsqueezy":
      return "Lemon Squeezy";
    case "founder":
      return "Основатель";
    default:
      return provider || "—";
  }
}

export function isCardProvider(provider: string): boolean {
  return ["card", "prodamus", "unicorn"].includes(provider);
}

export function moneyKzt(amount: number): string {
  return `${amount.toLocaleString("ru-KZ")} ₸`;
}
