import { type Prisma } from "./generated/prisma/client.js";
import {
  QUICK_SALE_TABLE_NAME,
  ComandaNotFoundError,
  ComandaNotMutableError,
  type Comanda,
} from "./comanda-types.js";
import { createAuditData } from "./audit.js";
import { mapPayment, paymentSelect } from "./payment-persistence.js";
import { COUNTER_TABLE_NAME, counterSaleSnapshot } from './counter-sales-types.js';
import { lockCounterSale } from './counter-sales-lock.js';
import { authorizeComandaMutation } from './comanda-source-access.js';
import { serviceFeeCents, CheckoutConflictError } from './service-fee.js';

export const comandaSelect = {
  serviceFeeApplied: true, serviceFeePercent: true, serviceFeeSubtotalCents: true, serviceFeeAmountCents: true,
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
    where: { quantity: { gt: 0 } },
    select: {
      additionalTotalCents: true,
      confirmedQuantity: true,
      configurations: {
        orderBy: { createdAt: "asc" },
        select: {
          additionals: {
            orderBy: { additionalName: "asc" },
            select: {
              additionalId: true,
              additionalName: true,
              id: true,
              quantityPerUnit: true,
              unitPriceCents: true,
            },
          },
          configurationKey: true,
          confirmedQuantity: true,
          id: true,
          quantity: true,
        },
        where: { quantity: { gt: 0 } },
      },
      createdAt: true,
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
    },
  },
  name: true,
  tableName: true,
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
    configurations: item.configurations.map((configuration) => ({
      ...configuration,
      subtotalCents:
        configuration.quantity *
        (item.unitPriceCents +
          configuration.additionals.reduce(
            (total, additional) =>
              total + additional.unitPriceCents * additional.quantityPerUnit,
            0,
          )),
    })),
    createdAt: item.createdAt.toISOString(),
    subtotalCents:
      item.unitPriceCents * item.quantity + item.additionalTotalCents,
  }));

  return {
    ...(comanda.serviceFeeApplied !== null ? { serviceFee: { included: comanda.serviceFeeApplied,
      percent: comanda.serviceFeePercent, subtotalCents: comanda.serviceFeeSubtotalCents ?? 0, amountCents: comanda.serviceFeeAmountCents } } : {}),
    operationalOrigin: creditOrder ? 'CREDIT' : deliveryOrder ? 'DELIVERY' : comanda.tableName === 'Balcão' ? 'COUNTER' :
      comanda.tableName === 'Venda rápida' ? 'QUICK_SALE' : 'TABLE',
    ...persistedComanda,
    ...(comanda.tableName === COUNTER_TABLE_NAME ? { counterSnapshot: counterSaleSnapshot(comanda.id, items) } : {}),
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
      (comanda.serviceFeeApplied !== null ? comanda.serviceFeeSubtotalCents ?? 0 : items.reduce((total, item) => total + item.subtotalCents, 0)) +
      (deliveryOrder?.feeCents ?? 0) + comanda.serviceFeeAmountCents,
  };
}

export async function findOpenComanda(
  transaction: Transaction,
  establishmentId: string,
  id: string,
) {
  await transaction.$queryRaw`SELECT id FROM Comanda WHERE id = ${id} AND establishmentId = ${establishmentId} FOR UPDATE`;
  const counter = await lockCounterSale(transaction, establishmentId, id);
  await authorizeComandaMutation(transaction, establishmentId, id);
  if (counter && counter.status !== 'OPEN') throw new ComandaNotMutableError();
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
      tableName: true,
      tableId: true,
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
    (!comanda.activeForTable && !isMutableCreditOrder && !comanda.deliveryOrder &&
      !(comanda.tableId === null && [QUICK_SALE_TABLE_NAME, COUNTER_TABLE_NAME].includes(comanda.tableName ?? '') && !comanda.creditOrder))
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
  actorUserId: string,
) {
  const order = await transaction.creditOrder.findFirst({
    select: {
      id: true,
      status: true,
      payments: { select: { amountCents: true } },
      comanda: { select: { serviceFeeApplied: true, serviceFeePercent: true, serviceFeeSubtotalCents: true, serviceFeeAmountCents: true } },
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
      additionalTotalCents: true,
      quantity: true,
      unitPriceCents: true,
      configurations: { select: { confirmedQuantity: true, additionals: { select: { quantityPerUnit: true, unitPriceCents: true } } } },
    },
    where: {
      comandaId,
    },
  });
  const deliveryOrder = await transaction.deliveryOrder.findFirst({
    select: { feeCents: true },
    where: { comandaId, establishmentId },
  });
  const hasFeeDecision = order.comanda.serviceFeeApplied !== null;
  const confirmedSubtotal = items.reduce((sum, item) => sum + item.configurations.reduce((value, config) => value +
    config.confirmedQuantity * (item.unitPriceCents + config.additionals.reduce((cost, extra) => cost + extra.quantityPerUnit * extra.unitPriceCents, 0)), 0), 0);
  const confirmedItemCount = items.reduce((sum, item) => sum + item.configurations.reduce((count, config) => count + config.confirmedQuantity, 0), 0);
  const previousCount = hasFeeDecision ? await transaction.comandaEvent.aggregate({ where: { establishmentId, comandaId, type: 'SERVICE_FEE_CHANGED' }, _sum: { confirmedItemDelta: true } }) : null;
  const itemCountDelta = confirmedItemCount - (previousCount?._sum.confirmedItemDelta ?? 0);
  const subtotalCents = hasFeeDecision ? confirmedSubtotal : items.reduce(
    (total, item) =>
      total + item.quantity * item.unitPriceCents + item.additionalTotalCents,
    0,
  );
  const fee = serviceFeeCents(subtotalCents, order.comanda.serviceFeePercent);
  const totalCents = subtotalCents + fee + (deliveryOrder?.feeCents ?? 0);
  if (hasFeeDecision && totalCents < order.payments.reduce((sum, payment) => sum + payment.amountCents, 0)) throw new CheckoutConflictError();
  if (hasFeeDecision && (itemCountDelta !== 0 || fee !== order.comanda.serviceFeeAmountCents || subtotalCents !== order.comanda.serviceFeeSubtotalCents)) {
    await transaction.comanda.update({ where: { id_establishmentId: { id: comandaId, establishmentId } }, data: { serviceFeeSubtotalCents: subtotalCents, serviceFeeAmountCents: fee } });
    const delta = fee - order.comanda.serviceFeeAmountCents;
    await transaction.comandaEvent.create({ data: { establishmentId, comandaId, actorUserId,
      type: 'SERVICE_FEE_CHANGED', serviceFeeDeltaCents: delta,
      confirmedItemDelta: itemCountDelta,
      consumptionDeltaCents: subtotalCents - (order.comanda.serviceFeeSubtotalCents ?? 0) } });
    await transaction.auditLog.create({ data: createAuditData({ action: 'SERVICE_FEE_RECALCULATED', establishmentId,
      resourceType: 'COMANDA', resourceId: comandaId, userId: actorUserId,
      metadata: { before: order.comanda, after: { subtotalCents, percent: order.comanda.serviceFeePercent, amountCents: fee } } }) });
  }
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
