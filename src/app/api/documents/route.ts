import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatInvoiceNumber } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

/** Paid orders belonging to the signed-in user, for the documents list. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.paymentOrder.findMany({
    where: { userId: session.user.id, status: "PAID" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amountKzt: true,
      createdAt: true,
      brandClaim: { select: { brandName: true } },
      brand: { select: { name: true } },
      invoice: { select: { number: true, issuedAt: true } },
    },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      amountKzt: order.amountKzt,
      createdAt: order.createdAt,
      brandName: order.brandClaim?.brandName ?? order.brand?.name ?? null,
      invoiceNumber: order.invoice
        ? formatInvoiceNumber(order.invoice.number, order.invoice.issuedAt)
        : null,
    })),
  });
}
