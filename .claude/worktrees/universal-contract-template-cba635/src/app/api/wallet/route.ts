import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let wallet = await prisma.wallet.findUnique({
    where: { userId: session.user.id },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: session.user.id, balance: 0 },
      include: {
        transactions: true,
      },
    });
  }

  return NextResponse.json({ wallet });
}
