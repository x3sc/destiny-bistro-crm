import { type PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  addComandaItem,
  changeComandaItemQuantity,
  confirmComandaItem,
  removeComandaItem,
} from "./comanda-item-operations.js";
import {
  comandaSelect,
  getComandaOrThrow,
  mapComanda,
  type Transaction,
} from "./comanda-persistence.js";
import {
  ComandaNotCancellableError,
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
    async cancel(establishmentId, id, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        const activeComanda = await transaction.comanda.findFirst({
          select: {
            activeForTable: {
              select: {
                id: true,
              },
            },
            _count: {
              select: {
                items: true,
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
          activeComanda._count.items > 0
        ) {
          throw new ComandaNotCancellableError();
        }

        await releaseActiveTable(
          transaction,
          establishmentId,
          id,
          activeComanda.tableId,
          () => new ComandaNotCancellableError(),
        );
        await cancelOpenComanda(transaction, establishmentId, id);

        await transaction.comandaEvent.create({
          data: {
            actorUserId,
            comandaId: id,
            establishmentId,
            reason: "OPENED_BY_MISTAKE",
            type: "CANCELLED",
          },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "COMANDA_CANCELLED",
            establishmentId,
            resourceId: id,
            resourceType: "COMANDA",
            userId: actorUserId,
          }),
        });

        return getComandaOrThrow(transaction, establishmentId, id);
      });
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
                confirmedQuantity: true,
                quantity: true,
                unitPriceCents: true,
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
          !activeComanda.activeForTable ||
          activeComanda.tableId === null ||
          hasPendingItems
        ) {
          throw new ComandaNotClosableError();
        }

        const totalCents = activeComanda.items.reduce(
          (total, item) => total + item.quantity * item.unitPriceCents,
          0,
        );
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

        await releaseActiveTable(
          transaction,
          establishmentId,
          id,
          activeComanda.tableId,
          () => new ComandaNotClosableError(),
        );

        const paidAt = new Date();

        if (balanceCents > 0) {
          const order = await transaction.creditOrder.create({
            data: {
              comandaId: id,
              customerId: customerId!,
              establishmentId,
              finalizedAt: paidAt,
              orderedAt: activeComanda.openedAt,
              source: "TABLE",
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
              origin: "TABLE_CHECKOUT",
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
            origin: "TABLE_CHECKOUT",
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
) {
  const cancelledComanda = await transaction.comanda.updateMany({
    data: {
      cancellationReason: "OPENED_BY_MISTAKE",
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
