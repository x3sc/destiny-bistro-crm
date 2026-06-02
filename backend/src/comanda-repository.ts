import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

export type ComandaStatus = "OPEN" | "CANCELLED";
export type ComandaEventType = "OPENED" | "CANCELLED";
export type ComandaCancellationReason = "OPENED_BY_MISTAKE";

export interface ComandaEvent {
  createdAt: string;
  reason: ComandaCancellationReason | null;
  type: ComandaEventType;
}

export interface Comanda {
  cancellationReason: ComandaCancellationReason | null;
  cancelledAt: string | null;
  events: ComandaEvent[];
  id: string;
  number: number;
  openedAt: string;
  status: ComandaStatus;
  table: {
    id: number;
    number: number;
  };
}

export interface ComandaRepository {
  cancel(id: string): Promise<Comanda>;
  findById(id: string): Promise<Comanda>;
  openForTable(tableId: number): Promise<Comanda>;
}

export class TableNotFoundError extends Error {}
export class TableUnavailableError extends Error {}
export class ComandaNotFoundError extends Error {}
export class ComandaNotCancellableError extends Error {}

const comandaSelect = {
  cancellationReason: true,
  cancelledAt: true,
  events: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      createdAt: true,
      reason: true,
      type: true,
    },
  },
  id: true,
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

function mapComanda(comanda: PersistedComanda): Comanda {
  return {
    ...comanda,
    cancelledAt: comanda.cancelledAt?.toISOString() ?? null,
    events: comanda.events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    openedAt: comanda.openedAt.toISOString(),
  };
}

export function createComandaRepository(prisma: PrismaClient): ComandaRepository {
  return {
    async cancel(id) {
      return prisma.$transaction(async (transaction) => {
        const activeComanda = await transaction.comanda.findUnique({
          select: {
            activeForTable: {
              select: {
                id: true,
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

        if (activeComanda.status !== "OPEN" || !activeComanda.activeForTable) {
          throw new ComandaNotCancellableError();
        }

        const releasedTable = await transaction.restaurantTable.updateMany({
          data: {
            activeComandaId: null,
            status: "FREE",
          },
          where: {
            activeComandaId: id,
            id: activeComanda.tableId,
            status: "OPEN",
          },
        });

        if (releasedTable.count !== 1) {
          throw new ComandaNotCancellableError();
        }

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

        await transaction.comandaEvent.create({
          data: {
            comandaId: id,
            reason: "OPENED_BY_MISTAKE",
            type: "CANCELLED",
          },
        });

        return mapComanda(
          await transaction.comanda.findUniqueOrThrow({
            select: comandaSelect,
            where: { id },
          }),
        );
      });
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
    async openForTable(tableId) {
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
  };
}
