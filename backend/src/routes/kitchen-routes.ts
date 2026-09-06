import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  isKitchenTicketStatus,
  type KitchenRepository,
  KitchenTicketNotFoundError,
  KitchenTicketStatusConflictError,
} from "../kitchen-types.js";

interface TicketParams {
  ticketId: string;
}

interface StatusBody {
  status?: unknown;
}

export function registerKitchenRoutes(
  app: FastifyInstance,
  kitchen: KitchenRepository,
) {
  app.get(
    "/kitchen/tickets",
    { config: { permission: "kitchen.read" } },
    async (request, reply) => {
      try {
        return {
          tickets: await kitchen.listOperational(
            requireAuthUser(request).establishment.id,
          ),
        };
      } catch (error) {
        app.log.error(error, "Kitchen ticket query failed");
        return reply.code(503).send({
          message: "Kitchen tickets unavailable",
          status: "error",
        });
      }
    },
  );

  app.get<{ Params: TicketParams }>(
    "/kitchen/tickets/:ticketId",
    { config: { permission: "kitchen.read" } },
    async (request, reply) => {
      try {
        return {
          ticket: await kitchen.findById(
            requireAuthUser(request).establishment.id,
            request.params.ticketId,
          ),
        };
      } catch (error) {
        return handleKitchenError(app, reply, error);
      }
    },
  );

  app.patch<{ Body: StatusBody; Params: TicketParams }>(
    "/kitchen/tickets/:ticketId/status",
    { config: { permission: "kitchen.write" } },
    async (request, reply) => {
      if (!isKitchenTicketStatus(request.body?.status)) {
        return reply.code(400).send({
          message: "Invalid kitchen ticket status",
          status: "error",
        });
      }
      try {
        const user = requireAuthUser(request);
        return {
          ticket: await kitchen.updateStatus(
            user.establishment.id,
            request.params.ticketId,
            request.body.status,
            user.id,
          ),
        };
      } catch (error) {
        return handleKitchenError(app, reply, error);
      }
    },
  );
}

function handleKitchenError(
  app: FastifyInstance,
  reply: {
    code(statusCode: number): { send(payload: unknown): unknown };
  },
  error: unknown,
) {
  if (error instanceof KitchenTicketNotFoundError) {
    return reply.code(404).send({
      message: "Kitchen ticket not found",
      status: "error",
    });
  }
  if (error instanceof KitchenTicketStatusConflictError) {
    return reply.code(409).send({
      message: "Invalid kitchen ticket transition",
      status: "error",
    });
  }
  app.log.error(error, "Kitchen ticket operation failed");
  return reply.code(503).send({
    message: "Kitchen tickets unavailable",
    status: "error",
  });
}
