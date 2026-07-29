import { type Prisma } from "./generated/prisma/client.js";
import {
  ComandaNotFoundError,
  ComandaNotMutableError,
  type Comanda,
} from "./comanda-types.js";
import { createAuditData } from "./audit.js";

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
      source: true,
      status: true,
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
  const { creditOrder, ...persistedComanda } = comanda;
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
      ? {
          customerId: creditOrder.customerId,
          customerName: creditOrder.customer.name,
          orderId: creditOrder.id,
          source: creditOrder.source,
          status: creditOrder.status,
        }
      : null,
    events: comanda.events.map(({ actorUser, ...event }) => ({
      ...event,
      actor: actorUser,
      createdAt: event.createdAt.toISOString(),
    })),
    items,
    openedAt: comanda.openedAt.toISOString(),
    totalCents: items.reduce((total, item) => total + item.subtotalCents, 0),
  };
}

export async function findOpenComanda(transaction: Transaction, id: string) {
  const comanda = await transaction.comanda.findUnique({
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
      status: true,
    },
    where: { id },
  });

  if (!comanda) {
    throw new ComandaNotFoundError();
  }

  const isMutableCreditOrder =
    comanda.creditOrder?.status === "DRAFT" ||
    comanda.creditOrder?.status === "OPEN";

  if (comanda.status !== "OPEN" || (!comanda.activeForTable && !isMutableCreditOrder)) {
    throw new ComandaNotMutableError();
  }
}

export async function getComandaOrThrow(transaction: Transaction, id: string) {
  return mapComanda(
    await transaction.comanda.findUniqueOrThrow({
      select: comandaSelect,
      where: { id },
    }),
  );
}

export async function syncOpenCreditOrderTotal(
  transaction: Transaction,
  comandaId: string,
) {
  const order = await transaction.creditOrder.findUnique({
    select: {
      id: true,
      status: true,
    },
    where: {
      comandaId,
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
  const totalCents = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
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
    data,
  });
  await transaction.auditLog.create({
    data: createAuditData({
      action: `COMANDA_${data.type}`,
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
