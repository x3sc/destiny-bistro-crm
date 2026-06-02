import type { FastifyInstance } from "fastify";
import {
  ComandaNotCancellableError,
  ComandaNotFoundError,
  type ComandaRepository,
} from "../comanda-repository.js";

interface ComandaParams {
  comandaId: string;
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
}
