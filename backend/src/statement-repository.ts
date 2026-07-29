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
      const [closedComandas, cancelledComandas, creditOrders] =
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
                  settlement: {
                    select: {
                      amountCents: true,
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
                  events: {
                    orderBy: {
                      createdAt: "asc",
                    },
                    select: {
                      createdAt: true,
                      newQuantity: true,
                      previousQuantity: true,
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
              ],
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
                          comanda.creditOrder.settlement?.amountCents ??
                          comanda.creditOrder.totalCents,
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
        creditOrders: creditOrders.flatMap((order) => {
          if (!order.finalizedAt) {
            return [];
          }

          const events = order.comanda.events.flatMap((event) =>
            event.newQuantity === null ||
            event.previousQuantity === null ||
            event.unitPriceCents === null
              ? []
              : [
                  {
                    createdAt: event.createdAt,
                    newQuantity: event.newQuantity,
                    previousQuantity: event.previousQuantity,
                    unitPriceCents: event.unitPriceCents,
                  },
                ],
          );

          return [
            {
              comanda: {
                events,
                id: order.comanda.id,
                name: order.comanda.name,
                number: order.comanda.number,
                status: order.comanda.status,
                tableNumber: order.comanda.table?.number ?? null,
              },
              customerName: order.customer.name,
              finalizedAt: order.finalizedAt,
              source: order.source,
            },
          ];
        }),
      };

      return buildStatementReport(period, source);
    },
  };
}
