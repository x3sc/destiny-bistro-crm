import { type Prisma } from "./generated/prisma/client.js";
import {
  ComandaNotFoundError,
  ComandaNotMutableError,
  type Comanda,
} from "./comanda-types.js";
import { createAuditData } from "./audit.js";
import { mapPayment, paymentSelect } from "./payment-persistence.js";

export const comandaSelect = {
  cancellationReason: true,
  cancelledAt: true,
  closedAt: true,
  creditOrder: {
    select: {
      customer: {
        select: {
          name: true,
        },
      },
      customerId: true,
      id: true,
      payments: {
        select: {
          amountCents: true,
        },
      },
      source: true,
      status: true,
      totalCents: true,
    },
  },
  deliveryOrder: {
    select: {
      feeCents: true,
      id: true,
    },
  },
  events: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      actorUser: {
        select: {
          id: true,
          name: true,
        },
      },
      createdAt: true,
      itemId: true,
      newQuantity: true,
      previousQuantity: true,
      productId: true,
      productName: true,
      reason: true,
      type: true,
      unitPriceCents: true,
    },
  },
  id: true,
  items: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      confirmedQuantity: true,
      createdAt: true,
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
    },
  },
  name: true,
  number: true,
  openedAt: true,
  payments: {
    orderBy: {
      paidAt: "asc",
    },
    select: paymentSelect,
  },
  status: true,
  table: {
    select: {
      id: true,
      number: true,
    },
  },
} satisfies Prisma.ComandaSelect;

type PersistedComanda = Prisma.ComandaGetPayload<{
  select: typeof comandaSelect;
}>;

export type Transaction = Prisma.TransactionClient;

export function mapComanda(comanda: PersistedComanda): Comanda {
  const { creditOrder, deliveryOrder, payments, ...persistedComanda } = comanda;
  const items = comanda.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    subtotalCents: item.unitPriceCents * item.quantity,
  }));

  return {
    ...persistedComanda,
    cancelledAt: comanda.cancelledAt?.toISOString() ?? null,
    closedAt: comanda.closedAt?.toISOString() ?? null,
    credit: creditOrder
      ? (() => {
          const paidCents = creditOrder.payments.reduce(
            (total, payment) => total + payment.amountCents,
            0,
          );
          return {
            balanceCents: Math.max(creditOrder.totalCents - paidCents, 0),
            customerId: creditOrder.customerId,
            customerName: creditOrder.customer.name,
            orderId: creditOrder.id,
            paidCents,
            source: creditOrder.source,
            status: creditOrder.status,
            totalCents: creditOrder.totalCents,
          };
        })()
      : null,
    events: comanda.events.map(({ actorUser, ...event }) => ({
      ...event,
      actor: actorUser,
      createdAt: event.createdAt.toISOString(),
    })),
    items,
    openedAt: comanda.openedAt.toISOString(),
    payments: payments.map(mapPayment),
    totalCents:
      items.reduce((total, item) => total + item.subtotalCents, 0) +
      (deliveryOrder?.feeCents ?? 0),
  };
}

export async function findOpenComanda(
  transaction: Transaction,
  establishmentId: string,
  id: string,
) {
  const comanda = await transaction.comanda.findFirst({
    select: {
      activeForTable: {
        select: {
          id: true,
        },
      },
      creditOrder: {
        select: {
          status: true,
        },
      },
      deliveryOrder: {
        select: { id: true },
      },
      status: true,
    },
    where: { establishmentId, id },
  });

  if (!comanda) {
    throw new ComandaNotFoundError();
  }

  const isMutableCreditOrder =
    comanda.creditOrder?.status === "DRAFT" ||
    comanda.creditOrder?.status === "OPEN";

  if (
    comanda.status !== "OPEN" ||
    (!comanda.activeForTable && !isMutableCreditOrder && !comanda.deliveryOrder)
  ) {
    throw new ComandaNotMutableError();
  }
}

export async function getComandaOrThrow(
  transaction: Transaction,
  establishmentId: string,
  id: string,
) {
  return mapComanda(
    await transaction.comanda.findFirstOrThrow({
      select: comandaSelect,
      where: { establishmentId, id },
    }),
  );
}

export async function syncOpenCreditOrderTotal(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
) {
  const order = await transaction.creditOrder.findFirst({
    select: {
      id: true,
      status: true,
    },
    where: {
      comandaId,
      comanda: {
        establishmentId,
      },
    },
  });

  if (order?.status !== "OPEN") {
    return;
  }

  const items = await transaction.comandaItem.findMany({
    select: {
      quantity: true,
      unitPriceCents: true,
    },
    where: {
      comandaId,
    },
  });
  const deliveryOrder = await transaction.deliveryOrder.findFirst({
    select: { feeCents: true },
    where: { comandaId, establishmentId },
  });
  const totalCents = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  ) + (deliveryOrder?.feeCents ?? 0);
  const updated = await transaction.creditOrder.updateMany({
    data: {
      totalCents,
    },
    where: {
      id: order.id,
      status: "OPEN",
    },
  });

  if (updated.count !== 1) {
    throw new ComandaNotMutableError();
  }
}

export async function recordItemEvent(
  transaction: Transaction,
  data: {
    establishmentId: string;
    comandaId: string;
    itemId: string;
    newQuantity: number;
    previousQuantity: number;
    productId: string;
    productName: string;
    type: "ITEM_ADDED" | "ITEM_CONFIRMED" | "ITEM_QUANTITY_CHANGED" | "ITEM_REMOVED";
    unitPriceCents: number;
    actorUserId: string;
  },
) {
  await transaction.comandaEvent.create({
    data: {
      actorUserId: data.actorUserId,
      comandaId: data.comandaId,
      establishmentId: data.establishmentId,
      itemId: data.itemId,
      newQuantity: data.newQuantity,
      previousQuantity: data.previousQuantity,
      productId: data.productId,
      productName: data.productName,
      type: data.type,
      unitPriceCents: data.unitPriceCents,
    },
  });
  await transaction.auditLog.create({
    data: createAuditData({
      action: `COMANDA_${data.type}`,
      establishmentId: data.establishmentId,
      metadata: {
        comandaId: data.comandaId,
        newQuantity: data.newQuantity,
        previousQuantity: data.previousQuantity,
        productId: data.productId,
        productName: data.productName,
        unitPriceCents: data.unitPriceCents,
      },
      resourceId: data.itemId,
      resourceType: "COMANDA_ITEM",
      userId: data.actorUserId,
    }),
  });
}
