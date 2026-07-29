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
  TableNotFoundError,
  TableUnavailableError,
  type ComandaRepository,
} from "./comanda-types.js";

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
    async close(establishmentId, id, actorUserId) {
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

        await releaseActiveTable(
          transaction,
          establishmentId,
          id,
          activeComanda.tableId,
          () => new ComandaNotClosableError(),
        );

        const closedComanda = await transaction.comanda.updateMany({
          data: {
            closedAt: new Date(),
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
            type: "CLOSED",
          },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "COMANDA_CLOSED",
            establishmentId,
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
