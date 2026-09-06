import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  canTransitionKitchenTicket,
  type KitchenRepository,
  type KitchenTicket,
  KitchenTicketNotFoundError,
  type KitchenTicketStatus,
  KitchenTicketStatusConflictError,
} from "./kitchen-types.js";

const kitchenTicketSelect = {
  comanda: {
    select: {
      number: true,
      table: { select: { id: true, number: true } },
    },
  },
  comandaId: true,
  createdAt: true,
  id: true,
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      comandaItemId: true,
      configurations: {
        orderBy: { createdAt: "asc" as const },
        select: {
          additionals: {
            orderBy: { additionalName: "asc" as const },
            select: {
              additionalId: true,
              additionalName: true,
              id: true,
              quantityPerUnit: true,
            },
          },
          configurationKey: true,
          id: true,
          quantity: true,
        },
      },
      id: true,
      productId: true,
      productName: true,
      quantity: true,
    },
  },
  status: true,
  updatedAt: true,
} satisfies Prisma.KitchenTicketSelect;

type PersistedKitchenTicket = Prisma.KitchenTicketGetPayload<{
  select: typeof kitchenTicketSelect;
}>;

function mapKitchenTicket(ticket: PersistedKitchenTicket): KitchenTicket {
  const { comanda, ...summary } = ticket;
  return {
    ...summary,
    comandaNumber: comanda.number,
    createdAt: ticket.createdAt.toISOString(),
    table: comanda.table,
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function createKitchenRepository(
  prisma: PrismaClient,
): KitchenRepository {
  return {
    async findById(establishmentId, ticketId) {
      const ticket = await prisma.kitchenTicket.findFirst({
        select: kitchenTicketSelect,
        where: { establishmentId, id: ticketId },
      });
      if (!ticket) {
        throw new KitchenTicketNotFoundError();
      }
      return mapKitchenTicket(ticket);
    },
    async listOperational(establishmentId) {
      const tickets = await prisma.kitchenTicket.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: kitchenTicketSelect,
        where: {
          establishmentId,
          status: { in: ["PENDING", "PREPARING", "READY"] },
        },
      });
      return tickets.map(mapKitchenTicket);
    },
    async updateStatus(establishmentId, ticketId, status, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        const current = await transaction.kitchenTicket.findFirst({
          select: {
            comandaId: true,
            status: true,
          },
          where: { establishmentId, id: ticketId },
        });
        if (!current) {
          throw new KitchenTicketNotFoundError();
        }
        if (current.status === status) {
          return mapKitchenTicket(
            await transaction.kitchenTicket.findFirstOrThrow({
              select: kitchenTicketSelect,
              where: { establishmentId, id: ticketId },
            }),
          );
        }
        if (!canTransitionKitchenTicket(current.status, status)) {
          throw new KitchenTicketStatusConflictError();
        }
        const updated = await transaction.kitchenTicket.updateMany({
          data: { status },
          where: {
            establishmentId,
            id: ticketId,
            status: current.status,
          },
        });
        if (updated.count !== 1) {
          throw new KitchenTicketStatusConflictError();
        }
        await transaction.auditLog.create({
          data: createAuditData({
            action:
              status === "CANCELLED"
                ? "KITCHEN_TICKET_CANCELLED"
                : "KITCHEN_TICKET_STATUS_CHANGED",
            establishmentId,
            metadata: {
              comandaId: current.comandaId,
              newStatus: status,
              previousStatus: current.status,
            },
            resourceId: ticketId,
            resourceType: "KITCHEN_TICKET",
            userId: actorUserId,
          }),
        });
        return mapKitchenTicket(
          await transaction.kitchenTicket.findFirstOrThrow({
            select: kitchenTicketSelect,
            where: { establishmentId, id: ticketId },
          }),
        );
      });
    },
  };
}

export type { KitchenRepository, KitchenTicket, KitchenTicketStatus };
