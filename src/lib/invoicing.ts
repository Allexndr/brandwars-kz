import "server-only";

import { prisma } from "@/lib/prisma";
import type { BillingKind } from "@prisma/client";

/**
 * Accounting documents.
 *
 * A Kazakhstani company cannot expense a payment without an invoice and an
 * acceptance act — the accountant will not clear it. Until these exist the
 * platform can only take money from individuals paying out of their own pocket,
 * which rules out every ТОО and every agency.
 *
 * Documents are rendered as printable HTML rather than generated PDFs: no
 * dependency, no binary rendering in a serverless function, and "print to PDF"
 * produces exactly what an accountant needs.
 */

/** Seller details that appear on every document. Fill from env before launch. */
export type SellerDetails = {
  name: string;
  bin: string;
  address: string;
  bank: string;
  iban: string;
  bic: string;
  signatory: string;
};

export function sellerDetails(): SellerDetails {
  return {
    name: process.env.SELLER_NAME ?? "",
    bin: process.env.SELLER_BIN ?? "",
    address: process.env.SELLER_ADDRESS ?? "",
    bank: process.env.SELLER_BANK ?? "",
    iban: process.env.SELLER_IBAN ?? "",
    bic: process.env.SELLER_BIC ?? "",
    signatory: process.env.SELLER_SIGNATORY ?? "",
  };
}

/** True once the seller side is configured well enough to issue a document. */
export function sellerConfigured(): boolean {
  const seller = sellerDetails();
  return Boolean(seller.name && seller.bin);
}

export type EnsureInvoiceResult =
  | { ok: true; invoiceId: string; number: number; created: boolean }
  | { ok: false; reason: "order_not_found" | "not_paid" };

/**
 * Create the document for a paid order, once.
 *
 * Buyer details are snapshotted: a document must keep saying what it said when
 * it was issued, even if the payer later edits their profile.
 */
export async function ensureInvoiceForOrder(
  paymentOrderId: string,
): Promise<EnsureInvoiceResult> {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    select: {
      id: true,
      userId: true,
      amountKzt: true,
      status: true,
      appliedAt: true,
      invoice: { select: { id: true, number: true } },
      brandClaim: { select: { brandName: true } },
      user: {
        select: {
          email: true,
          name: true,
          billingProfile: true,
        },
      },
    },
  });

  if (!order) return { ok: false, reason: "order_not_found" };

  if (order.invoice) {
    return {
      ok: true,
      invoiceId: order.invoice.id,
      number: order.invoice.number,
      created: false,
    };
  }

  if (order.status !== "PAID") return { ok: false, reason: "not_paid" };

  const profile = order.user.billingProfile;
  const payerKind: BillingKind = profile?.kind ?? "INDIVIDUAL";
  const payerName =
    profile?.companyName?.trim() ||
    profile?.contactName?.trim() ||
    order.user.name?.trim() ||
    order.user.email ||
    "Покупатель";

  const description = order.brandClaim?.brandName
    ? `Размещение бренда «${order.brandClaim.brandName}» на игровой рекламной платформе BrandWars.kz`
    : "Услуги игрового рекламного размещения на платформе BrandWars.kz";

  const invoice = await prisma.invoice.create({
    data: {
      paymentOrderId: order.id,
      userId: order.userId,
      billingProfileId: profile?.id ?? null,
      amountKzt: order.amountKzt,
      payerKind,
      payerName,
      payerBin: profile?.bin ?? null,
      payerAddress: profile?.address ?? null,
      description,
      // The service is rendered the moment the placement is applied, so the
      // act is dated from that, not from when someone opens the page.
      actIssuedAt: order.appliedAt ?? new Date(),
    },
    select: { id: true, number: true },
  });

  return {
    ok: true,
    invoiceId: invoice.id,
    number: invoice.number,
    created: true,
  };
}

/** Document number in the form an accountant expects. */
export function formatInvoiceNumber(number: number, issuedAt: Date): string {
  return `BW-${issuedAt.getFullYear()}-${String(number).padStart(5, "0")}`;
}

/**
 * Amount in words — Kazakhstani invoices are expected to spell out the total,
 * and an unspelled amount is a common reason a document gets sent back.
 */
export function amountInWords(amount: number): string {
  const ones = [
    "", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
    "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
    "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
  ];
  const onesFem = [...ones];
  onesFem[1] = "одна";
  onesFem[2] = "две";
  const tens = [
    "", "", "двадцать", "тридцать", "сорок", "пятьдесят",
    "шестьдесят", "семьдесят", "восемьдесят", "девяносто",
  ];
  const hundreds = [
    "", "сто", "двести", "триста", "четыреста", "пятьсот",
    "шестьсот", "семьсот", "восемьсот", "девятьсот",
  ];

  function chunk(n: number, feminine: boolean): string {
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rest >= 20) {
      parts.push(tens[Math.floor(rest / 10)]);
      const o = rest % 10;
      if (o > 0) parts.push((feminine ? onesFem : ones)[o]);
    } else if (rest > 0) {
      parts.push((feminine ? onesFem : ones)[rest]);
    }
    return parts.join(" ");
  }

  function plural(n: number, forms: [string, string, string]): string {
    const m100 = n % 100;
    const m10 = m100 % 10;
    if (m100 >= 11 && m100 <= 14) return forms[2];
    if (m10 === 1) return forms[0];
    if (m10 >= 2 && m10 <= 4) return forms[1];
    return forms[2];
  }

  if (amount === 0) return "ноль тенге 00 тиын";

  const whole = Math.floor(amount);
  const words: string[] = [];

  const millions = Math.floor(whole / 1_000_000);
  const thousands = Math.floor((whole % 1_000_000) / 1000);
  const remainder = whole % 1000;

  if (millions > 0) {
    words.push(chunk(millions, false));
    words.push(plural(millions, ["миллион", "миллиона", "миллионов"]));
  }
  if (thousands > 0) {
    words.push(chunk(thousands, true));
    words.push(plural(thousands, ["тысяча", "тысячи", "тысяч"]));
  }
  if (remainder > 0) words.push(chunk(remainder, false));

  const text = words.filter(Boolean).join(" ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} ${plural(whole, ["тенге", "тенге", "тенге"])} 00 тиын`;
}
