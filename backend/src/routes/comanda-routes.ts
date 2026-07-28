import type { FastifyInstance } from "fastify";
import {
  ComandaItemNotFoundError,
  ComandaItemQuantityError,
  ComandaNotMutableError,
  ComandaNotCancellableError,
  ComandaNotClosableError,
  ComandaNotFoundError,
  ProductUnavailableError,
  type ComandaRepository,
} from "../comanda-repository.js";

interface ComandaParams {
  comandaId: string;
}

interface ComandaItemParams extends ComandaParams {
  itemId: string;
}

interface AddComandaItemBody {
  productId?: unknown;
}

interface ChangeComandaItemBody {
  delta?: unknown;
}

function isItemConflict(error: unknown) {
  return (
    error instanceof ComandaItemQuantityError ||
    error instanceof ComandaNotCancellableError ||
    error instanceof ComandaNotMutableError ||
    error instanceof ProductUnavailableError
  );
}

export function registerComandaRoutes(app: FastifyInstance, comandas: ComandaRepository) {
  app.get<{ Params: ComandaParams }>("/comandas/:comandaId", async (request, reply) => {
    try {
      return {
        comanda: await comandas.findById(request.params.comandaId),
      };
    } catch (error) {
      if (error instanceof ComandaNotFoundError) {
        return reply.code(404).send({
          status: "error",
          message: "Comanda not found",
        });
      }

      app.log.error(error, "Comanda query failed");

      return reply.code(503).send({
        status: "error",
        message: "Comanda unavailable",
      });
    }
  });

  app.post<{ Params: ComandaParams }>(
    "/comandas/:comandaId/cancel",
    async (request, reply) => {
      try {
        return {
          comanda: await comandas.cancel(request.params.comandaId),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }

        if (error instanceof ComandaNotCancellableError) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda cannot be cancelled",
          });
        }

        app.log.error(error, "Comanda cancellation failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.post<{ Params: ComandaParams }>(
    "/comandas/:comandaId/close",
    async (request, reply) => {
      try {
        return {
          comanda: await comandas.close(request.params.comandaId),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }

        if (error instanceof ComandaNotClosableError) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda cannot be closed",
          });
        }

        app.log.error(error, "Comanda closing failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.post<{ Body: AddComandaItemBody; Params: ComandaParams }>(
    "/comandas/:comandaId/items",
    async (request, reply) => {
      if (!request.body || typeof request.body.productId !== "string" || !request.body.productId) {
        return reply.code(409).send({
          status: "error",
          message: "Product unavailable",
        });
      }

      try {
        return {
          comanda: await comandas.addItem(request.params.comandaId, request.body.productId),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item creation failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.patch<{ Body: ChangeComandaItemBody; Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId",
    async (request, reply) => {
      if (!request.body || (request.body.delta !== 1 && request.body.delta !== -1)) {
        return reply.code(409).send({
          status: "error",
          message: "Invalid item quantity change",
        });
      }

      try {
        return {
          comanda: await comandas.changeItemQuantity(
            request.params.comandaId,
            request.params.itemId,
            request.body.delta,
          ),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError || error instanceof ComandaItemNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda item not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item quantity change failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.post<{ Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId/confirm",
    async (request, reply) => {
      try {
        return {
          comanda: await comandas.confirmItem(
            request.params.comandaId,
            request.params.itemId,
          ),
        };
      } catch (error) {
        if (
          error instanceof ComandaNotFoundError ||
          error instanceof ComandaItemNotFoundError
        ) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda item not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item confirmation failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.delete<{ Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId",
    async (request, reply) => {
      try {
        return {
          comanda: await comandas.removeItem(request.params.comandaId, request.params.itemId),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError || error instanceof ComandaItemNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda item not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item removal failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );
}
