import { type Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  CreditCustomerNameError,
  CreditCustomerNotFoundError,
  CreditOrderConflictError,
  CreditOrderNotFoundError,
  CreditSettlementConflictError,
  type CreditCustomerDetails,
  type CreditCustomerSummary,
  type CreditOrder,
  type CreditRepository,
} from "./credit-types.js";
import { createPayment, mapPayment, paymentSelect } from "./payment-persistence.js";
import { paymentTotal } from "./payment-types.js";

export * from "./credit-types.js";

const creditOrderSelect = {
  cancelledAt: true,
  comanda: {
    select: {
      items: {
        select: {
          confirmedQuantity: true,
          quantity: true,
        },
      },
      name: true,
      number: true,
      table: {
        select: {
          number: true,
        },
      },
    },
  },
  comandaId: true,
  customer: {
    select: {
      name: true,
    },
  },
  customerId: true,
  finalizedAt: true,
  id: true,
  orderedAt: true,
  payments: {
    orderBy: { paidAt: "asc" },
    select: paymentSelect,
  },
  settledAt: true,
  source: true,
  status: true,
  totalCents: true,
} satisfies Prisma.CreditOrderSelect;

type PersistedCreditOrder = Prisma.CreditOrderGetPayload<{
  select: typeof creditOrderSelect;
}>;

export function normalizeCreditCustomerName(value: string) {
  const name = value.trim().replace(/\s+/gu, " ");

  if (!name || name.length > 80) {
    throw new CreditCustomerNameError();
  }

  return {
    name,
    normalizedName: name.toLocaleLowerCase("pt-BR"),
  };
}

export function createCreditRepository(prisma: PrismaClient): CreditRepository {
  return {
    async cancelOrder(establishmentId, orderId, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        const order = await transaction.creditOrder.findFirst({
          select: {
            comanda: {
              select: {
                status: true,
              },
            },
            comandaId: true,
            status: true,
          },
          where: {
            comanda: { establishmentId },
            id: orderId,
          },
        });

        if (!order) {
          throw new CreditOrderNotFoundError();
        }

        if (order.status !== "DRAFT" || order.comanda.status !== "OPEN") {
          throw new CreditOrderConflictError();
        }

        const cancelledAt = new Date();
        const cancelledOrder = await transaction.creditOrder.updateMany({
          data: {
            cancelledAt,
            status: "CANCELLED",
          },
          where: {
            comanda: { establishmentId },
            id: orderId,
            status: "DRAFT",
          },
        });
        const cancelledComanda = await transaction.comanda.updateMany({
          data: {
            cancellationReason: "OPENED_BY_MISTAKE",
            cancelledAt,
            status: "CANCELLED",
          },
          where: {
            establishmentId,
            id: order.comandaId,
            status: "OPEN",
          },
        });

        if (cancelledOrder.count !== 1 || cancelledComanda.count !== 1) {
          throw new CreditOrderConflictError();
        }

        await transaction.comandaEvent.create({
          data: {
            actorUserId,
            comandaId: order.comandaId,
            establishmentId,
            reason: "OPENED_BY_MISTAKE",
            type: "CANCELLED",
          },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "CREDIT_ORDER_CANCELLED",
            establishmentId,
            metadata: { comandaId: order.comandaId },
            resourceId: orderId,
            resourceType: "CREDIT_ORDER",
            userId: actorUserId,
          }),
        });

        return getOrderOrThrow(transaction, establishmentId, orderId);
      });
    },
    async convertComanda(
      establishmentId,
      comandaId,
      customerId,
      actorUserId,
    ) {
      return prisma.$transaction(async (transaction) => {
        await ensureCustomerExists(transaction, establishmentId, customerId);

        const comanda = await transaction.comanda.findFirst({
          select: {
            activeForTable: {
              select: {
                id: true,
              },
            },
            creditOrder: {
              select: {
                id: true,
              },
            },
            items: {
              select: {
                additionalTotalCents: true,
                confirmedQuantity: true,
                quantity: true,
                unitPriceCents: true,
              },
            },
            openedAt: true,
            status: true,
            tableId: true,
          },
          where: { establishmentId, id: comandaId },
        });

        if (!comanda) {
          throw new CreditOrderNotFoundError();
        }

        if (
          comanda.status !== "OPEN" ||
          !comanda.activeForTable ||
          comanda.tableId === null ||
          comanda.creditOrder ||
          !hasFinalizedItems(comanda.items)
        ) {
          throw new CreditOrderConflictError();
        }

        const releasedTable = await transaction.restaurantTable.updateMany({
          data: {
            activeComandaId: null,
            status: "FREE",
          },
          where: {
            activeComandaId: comandaId,
            establishmentId,
            id: comanda.tableId,
            status: "OPEN",
          },
        });

        if (releasedTable.count !== 1) {
          throw new CreditOrderConflictError();
        }

        const finalizedAt = new Date();

        const order = await transaction.creditOrder.create({
          data: {
            comandaId,
            customerId,
            establishmentId,
            finalizedAt,
            orderedAt: comanda.openedAt,
            source: "TABLE",
            status: "OPEN",
            totalCents: totalItems(comanda.items),
          },
          select: creditOrderSelect,
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "COMANDA_CONVERTED_TO_CREDIT",
            establishmentId,
            metadata: { comandaId, customerId },
            resourceId: order.id,
            resourceType: "CREDIT_ORDER",
            userId: actorUserId,
          }),
        });

        return mapOrder(order);
      });
    },
    async createCustomer(establishmentId, rawName, actorUserId) {
      const { name, normalizedName } = normalizeCreditCustomerName(rawName);
      const customer = await prisma.$transaction(async (transaction) => {
        const persisted = await transaction.creditCustomer.upsert({
          create: {
            establishmentId,
            name,
            normalizedName,
          },
          select: {
            id: true,
            name: true,
          },
          update: {},
          where: {
            establishmentId_normalizedName: {
              establishmentId,
              normalizedName,
            },
          },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "CREDIT_CUSTOMER_SELECTED",
            establishmentId,
            metadata: { name: persisted.name },
            resourceId: persisted.id,
            resourceType: "CREDIT_CUSTOMER",
            userId: actorUserId,
          }),
        });

        return persisted;
      });

      return emptyCustomerSummary(customer);
    },
    async createOrder(establishmentId, customerId, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        const customer = await transaction.creditCustomer.findFirst({
          select: {
            id: true,
            name: true,
          },
          where: { establishmentId, id: customerId },
        });

        if (!customer) {
          throw new CreditCustomerNotFoundError();
        }

        const comanda = await transaction.comanda.create({
          data: {
            establishmentId,
            events: {
              create: {
                actorUserId,
                type: "OPENED",
              },
            },
            name: customer.name,
          },
          select: {
            id: true,
            openedAt: true,
          },
        });
        const order = await transaction.creditOrder.create({
          data: {
            comandaId: comanda.id,
            customerId,
            establishmentId,
            orderedAt: comanda.openedAt,
            source: "MANUAL",
          },
          select: creditOrderSelect,
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "CREDIT_ORDER_CREATED",
            establishmentId,
            metadata: { comandaId: comanda.id, customerId },
            resourceId: order.id,
            resourceType: "CREDIT_ORDER",
            userId: actorUserId,
          }),
        });

        return mapOrder(order);
      });
    },
    async finalizeOrder(establishmentId, orderId, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        const order = await transaction.creditOrder.findFirst({
          select: {
            comanda: {
              select: {
                items: {
                  select: {
                    additionalTotalCents: true,
                    confirmedQuantity: true,
                    quantity: true,
                    unitPriceCents: true,
                  },
                },
                status: true,
              },
            },
            comandaId: true,
            source: true,
            status: true,
          },
          where: {
            comanda: { establishmentId },
            id: orderId,
          },
        });

        if (!order) {
          throw new CreditOrderNotFoundError();
        }

        if (
          order.source !== "MANUAL" ||
          order.status !== "DRAFT" ||
          order.comanda.status !== "OPEN" ||
          !hasFinalizedItems(order.comanda.items)
        ) {
          throw new CreditOrderConflictError();
        }

        const finalizedAt = new Date();
        const finalizedOrder = await transaction.creditOrder.updateMany({
          data: {
            finalizedAt,
            status: "OPEN",
            totalCents: totalItems(order.comanda.items),
          },
          where: {
            comanda: { establishmentId },
            id: orderId,
            status: "DRAFT",
          },
        });
        if (finalizedOrder.count !== 1) {
          throw new CreditOrderConflictError();
        }
        await transaction.auditLog.create({
          data: createAuditData({
            action: "CREDIT_ORDER_FINALIZED",
            establishmentId,
            metadata: { comandaId: order.comandaId },
            resourceId: orderId,
            resourceType: "CREDIT_ORDER",
            userId: actorUserId,
          }),
        });

        return getOrderOrThrow(transaction, establishmentId, orderId);
      });
    },
    async findCustomer(establishmentId, customerId) {
      const customer = await prisma.creditCustomer.findFirst({
        select: {
          id: true,
          name: true,
          orders: {
            orderBy: {
              orderedAt: "desc",
            },
            select: creditOrderSelect,
          },
        },
        where: { establishmentId, id: customerId },
      });

      if (!customer) {
        throw new CreditCustomerNotFoundError();
      }

      return mapCustomerDetails(customer);
    },
    async listCustomers(establishmentId, includeInactive = false) {
      const customers = await prisma.creditCustomer.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          orders: {
            select: {
              payments: {
                select: { amountCents: true },
              },
              status: true,
              totalCents: true,
            },
            where: {
              status: {
                in: ["DRAFT", "OPEN"],
              },
            },
          },
        },
        where: includeInactive
          ? { establishmentId }
          : {
              establishmentId,
              orders: {
                some: {
                  status: {
                    in: ["DRAFT", "OPEN"],
                  },
                },
              },
            },
      });

      return customers.map(mapCustomerSummary);
    },
    async settleOrder(establishmentId, orderId, payments, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM CreditOrder
          WHERE id = ${orderId} AND establishmentId = ${establishmentId}
          FOR UPDATE
        `;

        const order = await transaction.creditOrder.findFirst({
          select: {
            comanda: {
              select: {
                items: {
                  select: {
                    confirmedQuantity: true,
                    quantity: true,
                  },
                },
                status: true,
              },
            },
            comandaId: true,
            customerId: true,
            payments: {
              select: { amountCents: true },
            },
            status: true,
            totalCents: true,
          },
          where: {
            comanda: { establishmentId },
            id: orderId,
          },
        });

        if (!order) {
          throw new CreditOrderNotFoundError();
        }

        if (
          order.status !== "OPEN" ||
          order.comanda.status !== "OPEN" ||
          order.totalCents <= 0 ||
          !hasFinalizedItems(order.comanda.items)
        ) {
          throw new CreditSettlementConflictError();
        }

        const paidCents = order.payments.reduce(
          (total, payment) => total + payment.amountCents,
          0,
        );
        const balanceCents = order.totalCents - paidCents;
        const amountCents = paymentTotal(payments);
        if (amountCents <= 0 || amountCents > balanceCents) {
          throw new CreditSettlementConflictError();
        }

        const paidAt = new Date();
        const persistedPayment = await createPayment(transaction, {
          actorUserId,
          allocations: payments,
          amountCents,
          comandaId: order.comandaId,
          creditOrderId: orderId,
          establishmentId,
          origin: "CREDIT_INSTALLMENT",
          paidAt,
        });
        const remainingCents = balanceCents - amountCents;

        if (remainingCents === 0) {
          const settledOrder = await transaction.creditOrder.updateMany({
            data: {
              settledAt: paidAt,
              status: "SETTLED",
            },
            where: {
              comanda: { establishmentId },
              id: orderId,
              status: "OPEN",
            },
          });
          const closedComanda = await transaction.comanda.updateMany({
            data: {
              closedAt: paidAt,
              status: "CLOSED",
            },
            where: {
              establishmentId,
              id: order.comandaId,
              status: "OPEN",
            },
          });

          if (settledOrder.count !== 1 || closedComanda.count !== 1) {
            throw new CreditSettlementConflictError();
          }

          await transaction.comandaEvent.create({
            data: {
              actorUserId,
              comandaId: order.comandaId,
              establishmentId,
              type: "CLOSED",
            },
          });
        }
        await transaction.auditLog.create({
          data: createAuditData({
            action:
              remainingCents === 0
                ? "CREDIT_ORDER_SETTLED"
                : "CREDIT_PAYMENT_RECORDED",
            establishmentId,
            metadata: {
              amountCents,
              comandaId: order.comandaId,
              paymentId: persistedPayment.id,
              payments: payments.map(({ amountCents: value, method }) => ({
                amountCents: value,
                method,
              })),
              remainingCents,
            },
            resourceId: orderId,
            resourceType: "CREDIT_ORDER",
            userId: actorUserId,
          }),
        });

        return {
          order: await getOrderOrThrow(transaction, establishmentId, orderId),
          payment: mapPayment(persistedPayment),
        };
      });
    },
  };
}

function hasFinalizedItems(
  items: { confirmedQuantity: number; quantity: number }[],
) {
  return (
    items.length > 0 &&
    items.every(
      (item) => item.quantity > 0 && item.quantity === item.confirmedQuantity,
    )
  );
}

function totalItems(
  items: { additionalTotalCents: number; quantity: number; unitPriceCents: number }[],
) {
  return items.reduce(
    (total, item) =>
      total + item.quantity * item.unitPriceCents + item.additionalTotalCents,
    0,
  );
}

function mapOrder(order: PersistedCreditOrder): CreditOrder {
  const payments = order.payments.map(mapPayment);
  const paidCents = payments.reduce(
    (total, payment) => total + payment.amountCents,
    0,
  );
  return {
    balanceCents: Math.max(order.totalCents - paidCents, 0),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    comandaId: order.comandaId,
    comandaName: order.comanda.name,
    comandaNumber: order.comanda.number,
    customerId: order.customerId,
    customerName: order.customer.name,
    finalizedAt: order.finalizedAt?.toISOString() ?? null,
    hasPendingItems: order.comanda.items.some(
      (item) => item.quantity > item.confirmedQuantity,
    ),
    id: order.id,
    orderedAt: order.orderedAt.toISOString(),
    paidCents,
    payments,
    settledAt: order.settledAt?.toISOString() ?? null,
    source: order.source,
    status: order.status,
    tableNumber: order.comanda.table?.number ?? null,
    totalCents: order.totalCents,
  };
}

function emptyCustomerSummary(customer: {
  id: string;
  name: string;
}): CreditCustomerSummary {
  return {
    balanceCents: 0,
    draftOrderCount: 0,
    id: customer.id,
    name: customer.name,
    openOrderCount: 0,
  };
}

function mapCustomerSummary(customer: {
  id: string;
  name: string;
  orders: {
    payments: { amountCents: number }[];
    status: "DRAFT" | "OPEN" | "SETTLED" | "CANCELLED";
    totalCents: number;
  }[];
}): CreditCustomerSummary {
  return {
    balanceCents: customer.orders.reduce(
      (total, order) =>
        total +
        (order.status === "OPEN"
          ? Math.max(
              order.totalCents -
                order.payments.reduce(
                  (paid, payment) => paid + payment.amountCents,
                  0,
                ),
              0,
            )
          : 0),
      0,
    ),
    draftOrderCount: customer.orders.filter(({ status }) => status === "DRAFT").length,
    id: customer.id,
    name: customer.name,
    openOrderCount: customer.orders.filter(({ status }) => status === "OPEN").length,
  };
}

function mapCustomerDetails(customer: {
  id: string;
  name: string;
  orders: PersistedCreditOrder[];
}): CreditCustomerDetails {
  const activeOrders = customer.orders.filter(
    ({ status }) => status === "DRAFT" || status === "OPEN",
  );

  return {
    ...mapCustomerSummary({
      id: customer.id,
      name: customer.name,
      orders: activeOrders,
    }),
    orders: customer.orders.map(mapOrder),
  };
}

async function ensureCustomerExists(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  customerId: string,
) {
  const customer = await transaction.creditCustomer.findFirst({
    select: {
      id: true,
    },
    where: {
      establishmentId,
      id: customerId,
    },
  });

  if (!customer) {
    throw new CreditCustomerNotFoundError();
  }
}

async function getOrderOrThrow(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  orderId: string,
) {
  const order = await transaction.creditOrder.findFirst({
    select: creditOrderSelect,
    where: {
      comanda: { establishmentId },
      id: orderId,
    },
  });

  if (!order) {
    throw new CreditOrderNotFoundError();
  }

  return mapOrder(order);
}
