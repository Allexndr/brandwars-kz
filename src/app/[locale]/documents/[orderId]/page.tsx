import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/PrintButton";
import {
  amountInWords,
  ensureInvoiceForOrder,
  formatInvoiceNumber,
  sellerConfigured,
  sellerDetails,
} from "@/lib/invoicing";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; orderId: string }>;
};

/**
 * Printable invoice and acceptance act for one paid order.
 *
 * Rendered as HTML with a print stylesheet instead of a generated PDF: the
 * browser's "print to PDF" produces exactly the file an accountant needs, with
 * no rendering dependency in a serverless function.
 *
 * Access is restricted to the payer — these documents carry legal details.
 */
export default async function DocumentsPage({ params }: Props) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true },
  });

  if (!order) notFound();
  // Documents are personal: only the payer may see them.
  if (order.userId !== session.user.id) notFound();

  if (order.status !== "PAID") {
    return (
      <div className="surface-card space-y-2">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Документы пока недоступны
        </h1>
        <p className="text-sm text-muted">
          Счёт и акт формируются после подтверждения оплаты. Если платёж уже
          прошёл, обновите страницу через минуту.
        </p>
      </div>
    );
  }

  const ensured = await ensureInvoiceForOrder(orderId);
  if (!ensured.ok) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id: ensured.invoiceId },
  });
  if (!invoice) notFound();

  const seller = sellerDetails();
  const configured = sellerConfigured();
  const number = formatInvoiceNumber(invoice.number, invoice.issuedAt);
  const dateStr = invoice.issuedAt.toLocaleDateString("ru-KZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const amount = invoice.amountKzt;

  return (
    <div className="space-y-6">
      {/* Print rules: one document per sheet, no site chrome, black on white. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { background: #fff !important; }
              header, footer, nav, .no-print { display: none !important; }
              .doc-sheet { break-after: page; box-shadow: none !important; border: none !important; padding: 0 !important; }
              .doc-sheet:last-child { break-after: auto; }
            }
            .doc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .doc-table th, .doc-table td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
            .doc-table th { background: #f2f2f2; font-weight: 600; }
          `,
        }}
      />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Закрывающие документы
          </h1>
          <p className="mt-1 text-sm text-muted">
            Счёт на оплату и акт выполненных работ. Сохраните через «Печать → в
            PDF» и передайте бухгалтеру.
          </p>
        </div>
        <PrintButton />
      </div>

      {!configured && (
        <p className="no-print rounded-brand bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-primary)]">
          Реквизиты продавца не заполнены в переменных окружения
          (<code>SELLER_NAME</code>, <code>SELLER_BIN</code> и остальные) —
          документ сформирован без них и юридической силы не имеет.
        </p>
      )}

      {/* ---------- Счёт на оплату ---------- */}
      <section className="doc-sheet surface-card space-y-4 text-ink">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold">
            Счёт на оплату № {number}
          </h2>
          <p className="text-sm text-muted">от {dateStr}</p>
        </div>

        <table className="doc-table">
          <tbody>
            <tr>
              <th style={{ width: "28%" }}>Поставщик</th>
              <td>
                {seller.name || "—"}
                {seller.bin ? `, БИН ${seller.bin}` : ""}
                {seller.address ? `, ${seller.address}` : ""}
              </td>
            </tr>
            <tr>
              <th>Банковские реквизиты</th>
              <td>
                {seller.bank || "—"}
                {seller.iban ? `, IBAN ${seller.iban}` : ""}
                {seller.bic ? `, БИК ${seller.bic}` : ""}
              </td>
            </tr>
            <tr>
              <th>Покупатель</th>
              <td>
                {invoice.payerName}
                {invoice.payerBin ? `, БИН/ИИН ${invoice.payerBin}` : ""}
                {invoice.payerAddress ? `, ${invoice.payerAddress}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>№</th>
              <th>Наименование услуги</th>
              <th style={{ width: "10%" }}>Кол-во</th>
              <th style={{ width: "18%" }}>Цена, ₸</th>
              <th style={{ width: "18%" }}>Сумма, ₸</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{invoice.description}</td>
              <td>1</td>
              <td>{amount.toLocaleString("ru-KZ")}</td>
              <td>{amount.toLocaleString("ru-KZ")}</td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-1 text-sm">
          <p className="text-right font-semibold">
            Итого к оплате: {amount.toLocaleString("ru-KZ")} ₸
          </p>
          <p className="text-right text-muted">
            Без НДС
          </p>
          <p>
            <span className="text-muted">Сумма прописью: </span>
            {amountInWords(amount)}
          </p>
        </div>

        <div className="pt-6 text-sm">
          <p>
            Исполнитель: ______________________{" "}
            {seller.signatory ? `/ ${seller.signatory} /` : ""}
          </p>
        </div>
      </section>

      {/* ---------- Акт выполненных работ ---------- */}
      <section className="doc-sheet surface-card space-y-4 text-ink">
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold">
            Акт выполненных работ № {number}
          </h2>
          <p className="text-sm text-muted">
            от{" "}
            {(invoice.actIssuedAt ?? invoice.issuedAt).toLocaleDateString(
              "ru-KZ",
              { day: "2-digit", month: "long", year: "numeric" },
            )}
          </p>
        </div>

        <table className="doc-table">
          <tbody>
            <tr>
              <th style={{ width: "28%" }}>Исполнитель</th>
              <td>
                {seller.name || "—"}
                {seller.bin ? `, БИН ${seller.bin}` : ""}
              </td>
            </tr>
            <tr>
              <th>Заказчик</th>
              <td>
                {invoice.payerName}
                {invoice.payerBin ? `, БИН/ИИН ${invoice.payerBin}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="doc-table">
          <thead>
            <tr>
              <th style={{ width: "6%" }}>№</th>
              <th>Наименование работ, услуг</th>
              <th style={{ width: "10%" }}>Кол-во</th>
              <th style={{ width: "18%" }}>Сумма, ₸</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{invoice.description}</td>
              <td>1</td>
              <td>{amount.toLocaleString("ru-KZ")}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm">
          <span className="text-muted">Всего оказано услуг на сумму: </span>
          {amountInWords(amount)}
        </p>

        <p className="text-sm text-muted">
          Услуги оказаны в полном объёме. Заказчик претензий по объёму, качеству
          и срокам оказания услуг не имеет.
        </p>

        <div className="grid gap-8 pt-6 text-sm sm:grid-cols-2">
          <p>
            Исполнитель: ______________________
            <br />
            {seller.signatory || ""}
          </p>
          <p>
            Заказчик: ______________________
            <br />
            {invoice.payerName}
          </p>
        </div>
      </section>

      <p className="no-print text-xs text-muted">
        Позиция бренда на платформе — игровая метрика и результат оплаченного
        размещения, а не оценка качества товаров или услуг.
      </p>
    </div>
  );
}
