import { type PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import { buildComandaPrintDocument } from "./comanda-print-document.js";
import {
  addComandaItem,
  changeComandaItemQuantity,
  confirmComandaItem,
  removeComandaItem,
} from "./comanda-item-operations.js";
import {
  cancelComandaItemConfiguration,
  configureComandaItemAdditionals,
} from "./comanda-configuration-operations.js";
import {
  comandaSelect,
  getComandaOrThrow,
  mapComanda,
  type Transaction,
} from "./comanda-persistence.js";
import {
  ComandaNotCancellableError,
  ComandaCancellationConflictError,
  ComandaInventoryPermissionError,
  ComandaNotClosableError,
  ComandaNotFoundError,
  ComandaCreditPermissionError,
  ComandaPaymentError,
  TableNotFoundError,
  TableUnavailableError,
  type ComandaRepository,
} from "./comanda-types.js";
import { createPayment } from "./payment-persistence.js";
import { paymentTotal } from "./payment-types.js";

export * from "./comanda-types.js";

export function createComandaRepository(prisma: PrismaClient): ComandaRepository {
  return {
    async addItem(establishmentId, comandaId, productId, actorUserId) {
      return prisma.$transaction((transaction) =>
        addComandaItem(
          transaction,
          establishmentId,
          comandaId,
          productId,
          actorUserId,
        ),
      );
    },
    async cancel(establishmentId, id, input, canWriteInventory, actorUserId) {
      try {
        return await prisma.$transaction(async (transaction) => {
        const sourceId = `COMANDA:${id}`;
        if (input) {
          const replay = await transaction.inventoryOperation.findUnique({
            where: {
              establishmentId_requestId: {
                establishmentId,
                requestId: input.requestId,
              },
            },
          });
          if (replay) {
            const comanda = await transaction.comanda.findFirst({
              select: { status: true },
              where: { establishmentId, id },
            });
            if (
              replay.type !== "CANCELLATION" ||
              replay.sourceId !== sourceId ||
              replay.reason !== input.reason ||
              comanda?.status !== "CANCELLED"
            ) {
              throw new ComandaCancellationConflictError();
            }
            return getComandaOrThrow(transaction, establishmentId, id);
          }
        }
        const activeComanda = await transaction.comanda.findFirst({
          select: {
            activeForTable: {
              select: {
                id: true,
              },
            },
            items: {
              select: {
                configurations: {
                  select: { confirmedQuantity: true, id: true },
                },
                id: true,
              },
            },
            status: true,
            tableId: true,
          },
          where: { establishmentId, id },
        });

        if (!activeComanda) {
          throw new ComandaNotFoundError();
        }

        if (
          activeComanda.status !== "OPEN" ||
          !activeComanda.activeForTable ||
          activeComanda.tableId === null ||
          (activeComanda.items.length > 0 && !input)
        ) {
          throw new ComandaNotCancellableError();
        }
        const hasConfirmedItems = activeComanda.items.some((item) =>
          item.configurations.some(
            (configuration) => configuration.confirmedQuantity > 0,
          ),
        );
        if (hasConfirmedItems && !canWriteInventory) {
          throw new ComandaInventoryPermissionError();
        }
        if (input) {
          await transaction.inventoryOperation.create({
            data: {
              actorUserId,
              comandaId: id,
              establishmentId,
              reason: input.reason,
              requestId: input.requestId,
              sourceId,
              type: "CANCELLATION",
            },
          });
          for (const item of activeComanda.items) {
            for (const configuration of item.configurations) {
              if (configuration.confirmedQuantity > 0) {
                await cancelComandaItemConfiguration(
                  transaction,
                  establishmentId,
                  id,
                  item.id,
                  configuration.id,
                  {
                    disposition: input.disposition,
                    quantity: configuration.confirmedQuantity,
                    reason: input.reason,
                    requestId: `${input.requestId.slice(0, 120)}-${configuration.id}`,
                  },
                  actorUserId,
                );
              }
            }
          }
          const itemIds = activeComanda.items.map(({ id: itemId }) => itemId);
          await transaction.comandaItemConfiguration.updateMany({
            data: { confirmedQuantity: 0, quantity: 0 },
            where: { comandaItemId: { in: itemIds } },
          });
          await transaction.comandaItem.updateMany({
            data: {
              additionalTotalCents: 0,
              confirmedQuantity: 0,
              quantity: 0,
            },
            where: { id: { in: itemIds } },
          });
        }

        await releaseActiveTable(
          transaction,
          establishmentId,
          id,
          activeComanda.tableId,
          () => new ComandaNotCancellableError(),
        );
        await cancelOpenComanda(
          transaction,
          establishmentId,
          id,
          input ? "OPERATOR_CANCELLED" : "OPENED_BY_MISTAKE",
        );

        await transaction.comandaEvent.create({
          data: {
            actorUserId,
            comandaId: id,
            establishmentId,
            reason: input ? "OPERATOR_CANCELLED" : "OPENED_BY_MISTAKE",
            type: "CANCELLED",
          },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "COMANDA_CANCELLED",
            establishmentId,
            metadata: input
              ? {
                  disposition: input.disposition,
                  reason: input.reason,
                  requestId: input.requestId,
                }
              : undefined,
            resourceId: id,
            resourceType: "COMANDA",
            userId: actorUserId,
          }),
        });

        return getComandaOrThrow(transaction, establishmentId, id);
        });
      } catch (error) {
        if (input && isUniqueConstraintError(error)) {
          const replay = await prisma.inventoryOperation.findUnique({
            where: {
              establishmentId_requestId: {
                establishmentId,
                requestId: input.requestId,
              },
            },
          });
          const comanda = await prisma.comanda.findFirst({
            select: { status: true },
            where: { establishmentId, id },
          });
          if (
            replay?.type === "CANCELLATION" &&
            replay.sourceId === `COMANDA:${id}` &&
            replay.reason === input.reason &&
            comanda?.status === "CANCELLED"
          ) {
            return prisma.$transaction((transaction) =>
              getComandaOrThrow(transaction, establishmentId, id),
            );
          }
          throw new ComandaCancellationConflictError();
        }
        throw error;
      }
    },
    async changeItemQuantity(
      establishmentId,
      comandaId,
      itemId,
      delta,
      actorUserId,
    ) {
      return prisma.$transaction((transaction) =>
        changeComandaItemQuantity(
          transaction,
          establishmentId,
          comandaId,
          itemId,
          delta,
          actorUserId,
        ),
      );
    },
    async configureItemAdditionals(
      establishmentId,
      comandaId,
      itemId,
      input,
      actorUserId,
    ) {
      return prisma.$transaction((transaction) =>
        configureComandaItemAdditionals(
          transaction,
          establishmentId,
          comandaId,
          itemId,
          input,
          actorUserId,
        ),
      );
    },
    async cancelItemConfiguration(
      establishmentId,
      comandaId,
      itemId,
      configurationId,
      input,
      actorUserId,
    ) {
      return prisma.$transaction((transaction) =>
        cancelComandaItemConfiguration(
          transaction,
          establishmentId,
          comandaId,
          itemId,
          configurationId,
          input,
          actorUserId,
        ),
      );
    },
    async close(
      establishmentId,
      id,
      payments,
      customerId,
      canCreateCredit,
      actorUserId,
    ) {
      return prisma.$transaction(async (transaction) => {
        const activeComanda = await transaction.comanda.findFirst({
          select: {
            activeForTable: {
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
            deliveryOrder: {
              select: {
                feeCents: true,
                id: true,
              },
            },
            openedAt: true,
            status: true,
            tableId: true,
          },
          where: { establishmentId, id },
        });

        if (!activeComanda) {
          throw new ComandaNotFoundError();
        }

        const hasPendingItems = activeComanda.items.some(
          (item) => item.quantity > item.confirmedQuantity,
        );

        if (
          activeComanda.status !== "OPEN" ||
          (!activeComanda.activeForTable && !activeComanda.deliveryOrder) ||
          (activeComanda.deliveryOrder && activeComanda.items.length === 0) ||
          hasPendingItems
        ) {
          throw new ComandaNotClosableError();
        }

        const totalCents = activeComanda.items.reduce(
          (total, item) =>
            total + item.quantity * item.unitPriceCents + item.additionalTotalCents,
          0,
        ) + (activeComanda.deliveryOrder?.feeCents ?? 0);
        const paidCents = paymentTotal(payments);
        const balanceCents = totalCents - paidCents;

        if (paidCents > totalCents || (balanceCents > 0 && !customerId)) {
          throw new ComandaPaymentError();
        }
        if (balanceCents > 0 && !canCreateCredit) {
          throw new ComandaCreditPermissionError();
        }

        if (customerId) {
          const customer = await transaction.creditCustomer.findFirst({
            select: { id: true },
            where: { establishmentId, id: customerId },
          });
          if (!customer) {
            throw new ComandaPaymentError();
          }
        }

        if (activeComanda.tableId !== null) {
          await releaseActiveTable(
            transaction,
            establishmentId,
            id,
            activeComanda.tableId,
            () => new ComandaNotClosableError(),
          );
        }

        const paidAt = new Date();

        if (balanceCents > 0) {
          const order = await transaction.creditOrder.create({
            data: {
              comandaId: id,
              customerId: customerId!,
              establishmentId,
              finalizedAt: paidAt,
              orderedAt: activeComanda.openedAt,
              source: activeComanda.deliveryOrder ? "DELIVERY" : "TABLE",
              status: "OPEN",
              totalCents,
            },
            select: { id: true },
          });

          if (paidCents > 0) {
            await createPayment(transaction, {
              actorUserId,
              allocations: payments,
              amountCents: paidCents,
              comandaId: id,
              creditOrderId: order.id,
              establishmentId,
              origin: activeComanda.deliveryOrder
                ? "DELIVERY_CHECKOUT"
                : "TABLE_CHECKOUT",
              paidAt,
            });
          }

          await transaction.auditLog.create({
            data: createAuditData({
              action: "COMANDA_CONVERTED_TO_CREDIT",
              establishmentId,
              metadata: {
                balanceCents,
                customerId,
                paidCents,
                payments: payments.map(({ amountCents, method }) => ({
                  amountCents,
                  method,
                })),
                totalCents,
              },
              resourceId: order.id,
              resourceType: "CREDIT_ORDER",
              userId: actorUserId,
            }),
          });

          return getComandaOrThrow(transaction, establishmentId, id);
        }

        if (paidCents > 0) {
          await createPayment(transaction, {
            actorUserId,
            allocations: payments,
            amountCents: paidCents,
            comandaId: id,
            establishmentId,
            origin: activeComanda.deliveryOrder
              ? "DELIVERY_CHECKOUT"
              : "TABLE_CHECKOUT",
            paidAt,
          });
        }

        const closedComanda = await transaction.comanda.updateMany({
          data: {
            closedAt: paidAt,
            status: "CLOSED",
          },
          where: {
            id,
            establishmentId,
            status: "OPEN",
          },
        });

        if (closedComanda.count !== 1) {
          throw new ComandaNotClosableError();
        }

        await transaction.comandaEvent.create({
          data: {
            actorUserId,
            comandaId: id,
            establishmentId,
            type: "CLOSED",
          },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "COMANDA_CLOSED",
            establishmentId,
            metadata: {
              paidCents,
              payments: payments.map(({ amountCents, method }) => ({
                amountCents,
                method,
              })),
              totalCents,
            },
            resourceId: id,
            resourceType: "COMANDA",
            userId: actorUserId,
          }),
        });

        return getComandaOrThrow(transaction, establishmentId, id);
      });
    },
    async confirmItem(establishmentId, comandaId, itemId, actorUserId) {
      return prisma.$transaction((transaction) =>
        confirmComandaItem(
          transaction,
          establishmentId,
          comandaId,
          itemId,
          actorUserId,
        ),
      );
    },
    async findById(establishmentId, id) {
      const comanda = await prisma.comanda.findFirst({
        select: comandaSelect,
        where: { establishmentId, id },
      });

      if (!comanda) {
        throw new ComandaNotFoundError();
      }

      return mapComanda(comanda);
    },
    async findPrintDocument(establishmentId, id, kind, generatedBy) {
      const comanda = await prisma.comanda.findFirst({
        select: {
          deliveryOrder: { select: { feeCents: true } },
          establishment: { select: { name: true } },
          id: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              configurations: {
                orderBy: { createdAt: "asc" },
                select: {
                  additionals: {
                    orderBy: { additionalName: "asc" },
                    select: {
                      additionalName: true,
                      quantityPerUnit: true,
                      unitPriceCents: true,
                    },
                  },
                  confirmedQuantity: true,
                  quantity: true,
                },
                where: { quantity: { gt: 0 } },
              },
              productName: true,
              requiresKitchen: true,
              unitPriceCents: true,
            },
            where: { quantity: { gt: 0 } },
          },
          name: true,
          number: true,
          openedAt: true,
          status: true,
          table: { select: { number: true } },
        },
        where: { establishmentId, id },
      });

      if (!comanda) {
        throw new ComandaNotFoundError();
      }

      return buildComandaPrintDocument(
        {
          ...comanda,
          deliveryFeeCents: comanda.deliveryOrder?.feeCents ?? null,
          establishmentName: comanda.establishment.name,
          tableNumber: comanda.table?.number ?? null,
        },
        kind,
        generatedBy,
      );
    },
    async openForTable(establishmentId, tableId, name, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        const claimedTable = await transaction.restaurantTable.updateMany({
          data: {
            status: "OPEN",
          },
          where: {
            activeComandaId: null,
            establishmentId,
            id: tableId,
            status: "FREE",
          },
        });

        if (claimedTable.count !== 1) {
          const tableExists = await transaction.restaurantTable.findFirst({
            select: {
              id: true,
            },
            where: {
              establishmentId,
              id: tableId,
            },
          });

          if (!tableExists) {
            throw new TableNotFoundError();
          }

          throw new TableUnavailableError();
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
            name,
            tableId,
          },
          select: comandaSelect,
        });

        const linkedTable = await transaction.restaurantTable.updateMany({
          data: {
            activeComandaId: comanda.id,
          },
          where: {
            establishmentId,
            id: tableId,
          },
        });

        if (linkedTable.count !== 1) {
          throw new TableUnavailableError();
        }

        await transaction.auditLog.create({
          data: createAuditData({
            action: "COMANDA_OPENED",
            establishmentId,
            metadata: {
              name,
              tableId,
            },
            resourceId: comanda.id,
            resourceType: "COMANDA",
            userId: actorUserId,
          }),
        });

        return mapComanda(comanda);
      });
    },
    async removeItem(establishmentId, comandaId, itemId, actorUserId) {
      return prisma.$transaction((transaction) =>
        removeComandaItem(
          transaction,
          establishmentId,
          comandaId,
          itemId,
          actorUserId,
        ),
      );
    },
  };
}

async function releaseActiveTable(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  tableId: number,
  conflictError: () => Error,
) {
  const releasedTable = await transaction.restaurantTable.updateMany({
    data: {
      activeComandaId: null,
      status: "FREE",
    },
    where: {
      activeComandaId: comandaId,
      establishmentId,
      id: tableId,
      status: "OPEN",
    },
  });

  if (releasedTable.count !== 1) {
    throw conflictError();
  }
}

async function cancelOpenComanda(
  transaction: Transaction,
  establishmentId: string,
  id: string,
  reason: "OPENED_BY_MISTAKE" | "OPERATOR_CANCELLED",
) {
  const cancelledComanda = await transaction.comanda.updateMany({
    data: {
      cancellationReason: reason,
      cancelledAt: new Date(),
      status: "CANCELLED",
    },
    where: {
      establishmentId,
      id,
      status: "OPEN",
    },
  });

  if (cancelledComanda.count !== 1) {
    throw new ComandaNotCancellableError();
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
