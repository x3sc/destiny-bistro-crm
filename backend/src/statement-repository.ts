import type { PrismaClient } from "./generated/prisma/client.js";
import {
  buildStatementReport,
  type StatementPeriod,
  type StatementReport,
  type StatementSourceData,
} from "./statement-report.js";

export interface StatementRepository {
  findReport(
    establishmentId: string,
    period: StatementPeriod,
  ): Promise<StatementReport>;
}

export function createStatementRepository(
  prisma: PrismaClient,
): StatementRepository {
  return {
    async findReport(establishmentId, period) {
      const [closedComandas, cancelledComandas, creditOrders, deliveries] =
        await prisma.$transaction([
          prisma.comanda.findMany({
            orderBy: {
              closedAt: "asc",
            },
            select: {
              closedAt: true,
              creditOrder: {
                select: {
                  customer: {
                    select: {
                      name: true,
                    },
                  },
                  payments: {
                    select: {
                      allocations: {
                        select: { amountCents: true, method: true },
                      },
                      amountCents: true,
                      id: true,
                      origin: true,
                      paidAt: true,
                    },
                  },
                  source: true,
                  totalCents: true,
                },
              },
              id: true,
              items: {
                select: {
                  confirmedQuantity: true,
                  productId: true,
                  productName: true,
                  quantity: true,
                  unitPriceCents: true,
                },
              },
              name: true,
              number: true,
              payments: {
                select: {
                  allocations: {
                    select: { amountCents: true, method: true },
                  },
                  amountCents: true,
                  id: true,
                  origin: true,
                  paidAt: true,
                },
              },
              status: true,
              table: {
                select: {
                  number: true,
                },
              },
            },
            where: {
              establishmentId,
              closedAt: {
                gte: period.startAt,
                lt: period.endAt,
              },
              status: "CLOSED",
            },
          }),
          prisma.comanda.findMany({
            orderBy: {
              cancelledAt: "asc",
            },
            select: {
              cancelledAt: true,
              creditOrder: {
                select: {
                  customer: {
                    select: {
                      name: true,
                    },
                  },
                  source: true,
                },
              },
              id: true,
              items: {
                select: {
                  confirmedQuantity: true,
                  productId: true,
                  productName: true,
                  quantity: true,
                  unitPriceCents: true,
                },
              },
              name: true,
              number: true,
              status: true,
              table: {
                select: {
                  number: true,
                },
              },
            },
            where: {
              establishmentId,
              cancelledAt: {
                gte: period.startAt,
                lt: period.endAt,
              },
              status: "CANCELLED",
            },
          }),
          prisma.creditOrder.findMany({
            orderBy: {
              finalizedAt: "asc",
            },
            select: {
              comanda: {
                select: {
                  closedAt: true,
                  events: {
                    orderBy: {
                      createdAt: "asc",
                    },
                    select: {
                      createdAt: true,
                      newQuantity: true,
                      previousQuantity: true,
                      productId: true,
                      productName: true,
                      unitPriceCents: true,
                    },
                    where: {
                      type: "ITEM_CONFIRMED",
                    },
                  },
                  id: true,
                  name: true,
                  number: true,
                  status: true,
                  table: {
                    select: {
                      number: true,
                    },
                  },
                },
              },
              customer: {
                select: {
                  name: true,
                },
              },
              finalizedAt: true,
              payments: {
                orderBy: { paidAt: "asc" },
                select: {
                  allocations: {
                    select: { amountCents: true, method: true },
                  },
                  amountCents: true,
                  id: true,
                  origin: true,
                  paidAt: true,
                },
              },
              source: true,
            },
            where: {
              customer: {
                establishmentId,
              },
              finalizedAt: {
                not: null,
              },
              status: {
                in: ["OPEN", "SETTLED"],
              },
              OR: [
                {
                  finalizedAt: {
                    gte: period.startAt,
                    lt: period.endAt,
                  },
                },
                {
                  comanda: {
                    events: {
                      some: {
                        createdAt: {
                          gte: period.startAt,
                          lt: period.endAt,
                        },
                        type: "ITEM_CONFIRMED",
                      },
                    },
                  },
                },
                {
                  payments: {
                    some: {
                      paidAt: {
                        gte: period.startAt,
                        lt: period.endAt,
                      },
                    },
                  },
                },
              ],
            },
          }),
          prisma.delivery.findMany({
            orderBy: { deliveredAt: "asc" },
            select: {
              address: true,
              customerName: true,
              day: {
                select: {
                  courier: {
                    select: { name: true },
                  },
                },
              },
              deliveredAt: true,
              feeCents: true,
              id: true,
              paymentMethod: true,
              totalCents: true,
            },
            where: {
              deliveredAt: {
                gte: period.startAt,
                lt: period.endAt,
              },
              establishmentId,
            },
          }),
        ]);

      const source: StatementSourceData = {
        cancelledComandas: cancelledComandas.flatMap((comanda) =>
          comanda.cancelledAt
            ? [
                {
                  cancelledAt: comanda.cancelledAt,
                  creditOrder: comanda.creditOrder
                    ? {
                        customerName: comanda.creditOrder.customer.name,
                        source: comanda.creditOrder.source,
                      }
                    : null,
                  id: comanda.id,
                  items: comanda.items,
                  name: comanda.name,
                  number: comanda.number,
                  status: comanda.status,
                  tableNumber: comanda.table?.number ?? null,
                },
              ]
            : [],
        ),
        closedComandas: closedComandas.flatMap((comanda) =>
          comanda.closedAt
            ? [
                {
                  closedAt: comanda.closedAt,
                  creditOrder: comanda.creditOrder
                    ? {
                        customerName: comanda.creditOrder.customer.name,
                        settlementAmountCents:
                          comanda.creditOrder.payments.reduce(
                            (total, payment) => total + payment.amountCents,
                            0,
                          ),
                        source: comanda.creditOrder.source,
                      }
                    : null,
                  id: comanda.id,
                  items: comanda.items,
                  name: comanda.name,
                  number: comanda.number,
                  payments: comanda.payments,
                  status: comanda.status,
                  tableNumber: comanda.table?.number ?? null,
                },
              ]
            : [],
        ),
        creditOrders: creditOrders.flatMap((order) => {
          if (!order.finalizedAt) {
            return [];
          }

          const events = order.comanda.events.flatMap((event) =>
            event.newQuantity === null ||
            event.previousQuantity === null ||
            event.productId === null ||
            event.productName === null ||
            event.unitPriceCents === null
              ? []
              : [
                  {
                    createdAt: event.createdAt,
                    newQuantity: event.newQuantity,
                    previousQuantity: event.previousQuantity,
                    productId: event.productId,
                    productName: event.productName,
                    unitPriceCents: event.unitPriceCents,
                  },
                ],
          );

          return [
            {
              comanda: {
                closedAt: order.comanda.closedAt,
                events,
                id: order.comanda.id,
                name: order.comanda.name,
                number: order.comanda.number,
                status: order.comanda.status,
                tableNumber: order.comanda.table?.number ?? null,
              },
              customerName: order.customer.name,
              finalizedAt: order.finalizedAt,
              payments: order.payments,
              source: order.source,
            },
          ];
        }),
        deliveries: deliveries.map((delivery) => ({
          address: delivery.address,
          courierName: delivery.day.courier.name,
          customerName: delivery.customerName,
          deliveredAt: delivery.deliveredAt,
          feeCents: delivery.feeCents,
          id: delivery.id,
          paymentMethod: delivery.paymentMethod,
          totalCents: delivery.totalCents,
        })),
      };

      return buildStatementReport(period, source);
    },
  };
}
