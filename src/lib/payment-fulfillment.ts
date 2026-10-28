import "server-only";

import { prisma } from "@/lib/prisma";
import { applyPaidLandOrder } from "@/lib/land-purchase";
import { recalculateCategory } from "@/lib/territory";
import { notifyChannels } from "@/lib/notify";
import { creditSupportEarnings } from "@/lib/brand-earnings";

/**
 * Receipt for a purchase made without an account.
 *
 * This is also how the buyer learns the email they paid with is their way in —
 * without it, an account-free checkout leaves them with no route back.
 */
async function sendClaimReceipt(params: {
  email: string;
  brandName: string;
  continent: string;
  amountKzt: number;
  claimId: string;
  orderId: string;
}): Promise<void> {
  const appUrl = process.env.NEXTAUTH_URL ?? "";
  const loginUrl = `${appUrl}/ru/login`;

  const docsUrl = `${appUrl}/ru/documents/${params.orderId}`;

  const text = [
    `Оплата получена: ${params.amountKzt.toLocaleString("ru-KZ")} ₸.`,
    `Бренд «${params.brandName}» отправляется на материк «${params.continent}».`,
    ``,
    `Дальше — короткая проверка модератором, после неё бренд появится на карте.`,
    ``,
    `Счёт и акт выполненных работ:`,
    docsUrl,
    `Реквизиты организации указываются в кабинете — тогда они попадут в документы.`,
    ``,
    `Чтобы управлять брендом, настроить персонажа и оформление — войдите по этой почте:`,
    loginUrl,
    ``,
    // The badge is the cheapest growth loop we have, and a link nobody sees is
    // a loop that never closes — so the code goes into the receipt itself.
    `Бесплатный бейдж для вашего сайта — покажите позицию посетителям:`,
    `${appUrl}/ru/brand/`,
    ``,
    `Позиция определяется оплаченной суммой, а не оценкой качества бренда.`,
  ].join("\n");

  await notifyChannels({
    toEmail: params.email,
    telegramChatId: null,
    subject: `BrandWars: оплата получена, «${params.brandName}» на модерации`,
    text,
    html: `<p>${text.replace(/\n/g, "<br/>")}</p><p><a href="${loginUrl}">Войти в кабинет</a></p>`,
  });
}

export async function fulfillPaidOrder(
  orderId: string,
  providerOrderId: string,
  confirmedAmountKzt?: number,
) {
  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ id: orderId }, { providerOrderId }, { idempotencyKey: orderId }],
    },
  });

  if (!order) return null;
  if (
    confirmedAmountKzt !== undefined &&
    confirmedAmountKzt !== order.amountKzt
  ) {
    return null;
  }
  if (order.appliedAt) return order;

  if (order.status !== "PAID") {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
  }

  const metadata = (order.metadata ?? {}) as {
    landIntent?: unknown;
    claimId?: string;
    purpose?: string;
  };

  if (metadata.landIntent) {
    await applyPaidLandOrder(order.id);
    return order;
  }

  if (metadata.claimId) {
    const claim = await prisma.brandClaim.findUnique({
      where: { id: metadata.claimId },
      select: {
        id: true,
        categoryId: true,
        brandName: true,
        contactEmail: true,
        bidAmountKzt: true,
      },
    });
    if (claim) {
      const activeSeason = await prisma.season.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      const seasonCategory = activeSeason
        ? await prisma.seasonCategory.findUnique({
            where: {
              seasonId_categoryId: {
                seasonId: activeSeason.id,
                categoryId: claim.categoryId,
              },
            },
            select: { id: true },
          })
        : null;

      await prisma.$transaction(async (tx) => {
        const claimed = await tx.paymentOrder.updateMany({
          where: { id: order.id, appliedAt: null },
          data: { appliedAt: new Date() },
        });
        if (claimed.count === 0) return;
        await tx.brandClaim.update({
          where: { id: claim.id },
          data: { paymentOrderId: order.id },
        });
        await tx.transaction.create({
          data: {
            paymentOrderId: order.id,
            userId: order.userId,
            seasonCategoryId: seasonCategory?.id,
            type: "BRAND_ENTRY",
            amountKzt: order.amountKzt,
            status: "COMPLETED",
            paymentProvider: order.paymentProvider,
            providerPaymentId: order.providerOrderId ?? providerOrderId,
          },
        });
      });

      // Close the loop for a purchase made without an account: the receipt is
      // also how the buyer learns they can sign in with this email to manage
      // the brand and set up its character.
      void prisma.category
        .findUnique({
          where: { id: claim.categoryId },
          select: { continentRu: true },
        })
        .then((category) =>
          sendClaimReceipt({
            email: claim.contactEmail,
            brandName: claim.brandName,
            continent: category?.continentRu ?? "планета",
            amountKzt: order.amountKzt,
            claimId: claim.id,
            orderId: order.id,
          }),
        )
        .catch((error) => console.error("[claim-receipt]", error));

      return order;
    }
  }

  if (order.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: order.brandId },
      select: { primaryCategoryId: true, ownerUserId: true },
    });
    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const seasonCategory =
      brand && activeSeason
        ? await prisma.seasonCategory.findUnique({
            where: {
              seasonId_categoryId: {
                seasonId: activeSeason.id,
                categoryId: brand.primaryCategoryId,
              },
            },
            select: { id: true },
          })
        : null;

    // Fan support: brand earns 80%. Owner boosting own brand is always TOP_UP —
    // never credit earnings to the payer who owns the brand (self-cashout loop).
    const isOwnerBoost = Boolean(
      brand?.ownerUserId && brand.ownerUserId === order.userId,
    );
    const isSupport =
      !isOwnerBoost &&
      (metadata.purpose === "support" ||
        (metadata.purpose !== "top_up" && Boolean(order.brandId)));

    const applied = await prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentOrder.updateMany({
        where: { id: order.id, appliedAt: null },
        data: { appliedAt: new Date() },
      });
      if (claimed.count === 0) return null;

      const txRow = await tx.transaction.create({
        data: {
          paymentOrderId: order.id,
          userId: order.userId,
          brandId: order.brandId,
          seasonCategoryId: seasonCategory?.id,
          type: isSupport ? "SUPPORT" : "TOP_UP",
          amountKzt: order.amountKzt,
          status: "COMPLETED",
          paymentProvider: order.paymentProvider,
          providerPaymentId: order.providerOrderId ?? providerOrderId,
        },
      });

      if (isSupport && order.brandId) {
        await creditSupportEarnings({
          brandId: order.brandId,
          grossKzt: order.amountKzt,
          paymentOrderId: order.id,
          transactionId: txRow.id,
          db: tx,
        });
      }

      return txRow;
    });

    if (applied && seasonCategory) {
      await recalculateCategory(seasonCategory.id);
    }
    return order;
  }

  await prisma.paymentOrder.updateMany({
    where: { id: order.id, appliedAt: null },
    data: { appliedAt: new Date() },
  });
  return order;
}
