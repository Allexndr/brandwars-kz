"use client";

import { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  amountKzt: number;
  createdAt: string;
  brandName: string | null;
  invoiceNumber: string | null;
};

/**
 * Paid orders with a link to their documents.
 *
 * Every payment gets an invoice and an act on one printable page, so a company
 * can hand them straight to its accountant. Without this the money is
 * unbookable and a legal entity simply will not buy again.
 */
export function DocumentsList({ locale = "ru" }: { locale?: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/documents", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { orders: [] }))
      .then((data) => {
        if (alive) setOrders(data.orders ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded) return null;

  return (
    <section className="surface-card space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Счета и акты
        </h2>
        <p className="mt-1 text-sm text-muted">
          По каждой оплате — счёт и акт выполненных работ на одной странице.
          Сохраните через «Печать → в PDF».
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">
          Оплат пока нет. Документы появятся здесь сразу после первой.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {order.brandName ?? "Размещение на карте"}
                </p>
                <p className="text-xs text-muted">
                  {new Date(order.createdAt).toLocaleDateString("ru-KZ")}
                  {order.invoiceNumber ? ` · № ${order.invoiceNumber}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-semibold tabular-nums text-ink">
                  {order.amountKzt.toLocaleString("ru-KZ")} ₸
                </span>
                <a
                  href={`/${locale}/documents/${order.id}`}
                  target="_blank"
                  rel="noopener"
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  Счёт и акт
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
