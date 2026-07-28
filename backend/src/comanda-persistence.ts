import { type Prisma } from "./generated/prisma/client.js";
import {
  ComandaNotFoundError,
  ComandaNotMutableError,
  type Comanda,
} from "./comanda-types.js";

export const comandaSelect = {
  cancellationReason: true,
  cancelledAt: true,
  closedAt: true,
  events: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
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
  const items = comanda.items.map((item) => ({
    ...item,
    subtotalCents: item.unitPriceCents * item.quantity,
  }));

  return {
    ...comanda,
    cancelledAt: comanda.cancelledAt?.toISOString() ?? null,
    closedAt: comanda.closedAt?.toISOString() ?? null,
    events: comanda.events.map((event) => ({
      ...event,
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
      status: true,
    },
    where: { id },
  });

  if (!comanda) {
    throw new ComandaNotFoundError();
  }

  if (comanda.status !== "OPEN" || !comanda.activeForTable) {
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
  },
) {
  await transaction.comandaEvent.create({
    data,
  });
}
