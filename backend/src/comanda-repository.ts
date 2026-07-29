import { type PrismaClient } from "./generated/prisma/client.js";
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
    async addItem(comandaId, productId) {
      return prisma.$transaction((transaction) =>
        addComandaItem(transaction, comandaId, productId),
      );
    },
    async cancel(id) {
      return prisma.$transaction(async (transaction) => {
        const activeComanda = await transaction.comanda.findUnique({
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
          where: { id },
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
          id,
          activeComanda.tableId,
          () => new ComandaNotCancellableError(),
        );
        await cancelOpenComanda(transaction, id);

        await transaction.comandaEvent.create({
          data: {
            comandaId: id,
            reason: "OPENED_BY_MISTAKE",
            type: "CANCELLED",
          },
        });

        return getComandaOrThrow(transaction, id);
      });
    },
    async changeItemQuantity(comandaId, itemId, delta) {
      return prisma.$transaction((transaction) =>
        changeComandaItemQuantity(transaction, comandaId, itemId, delta),
      );
    },
    async close(id) {
      return prisma.$transaction(async (transaction) => {
        const activeComanda = await transaction.comanda.findUnique({
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
          where: { id },
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
            status: "OPEN",
          },
        });

        if (closedComanda.count !== 1) {
          throw new ComandaNotClosableError();
        }

        await transaction.comandaEvent.create({
          data: {
            comandaId: id,
            type: "CLOSED",
          },
        });

        return getComandaOrThrow(transaction, id);
      });
    },
    async confirmItem(comandaId, itemId) {
      return prisma.$transaction((transaction) =>
        confirmComandaItem(transaction, comandaId, itemId),
      );
    },
    async findById(id) {
      const comanda = await prisma.comanda.findUnique({
        select: comandaSelect,
        where: { id },
      });

      if (!comanda) {
        throw new ComandaNotFoundError();
      }

      return mapComanda(comanda);
    },
    async openForTable(tableId, name) {
      return prisma.$transaction(async (transaction) => {
        const claimedTable = await transaction.restaurantTable.updateMany({
          data: {
            status: "OPEN",
          },
          where: {
            activeComandaId: null,
            id: tableId,
            status: "FREE",
          },
        });

        if (claimedTable.count !== 1) {
          const tableExists = await transaction.restaurantTable.findUnique({
            select: {
              id: true,
            },
            where: {
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
            events: {
              create: {
                type: "OPENED",
              },
            },
            name,
            tableId,
          },
          select: comandaSelect,
        });

        await transaction.restaurantTable.update({
          data: {
            activeComandaId: comanda.id,
          },
          where: {
            id: tableId,
          },
        });

        return mapComanda(comanda);
      });
    },
    async removeItem(comandaId, itemId) {
      return prisma.$transaction((transaction) =>
        removeComandaItem(transaction, comandaId, itemId),
      );
    },
  };
}

async function releaseActiveTable(
  transaction: Transaction,
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
      id: tableId,
      status: "OPEN",
    },
  });

  if (releasedTable.count !== 1) {
    throw conflictError();
  }
}

async function cancelOpenComanda(transaction: Transaction, id: string) {
  const cancelledComanda = await transaction.comanda.updateMany({
    data: {
      cancellationReason: "OPENED_BY_MISTAKE",
      cancelledAt: new Date(),
      status: "CANCELLED",
    },
    where: {
      id,
      status: "OPEN",
    },
  });

  if (cancelledComanda.count !== 1) {
    throw new ComandaNotCancellableError();
  }
}
