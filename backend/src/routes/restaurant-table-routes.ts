import type { FastifyInstance } from "fastify";
import {
  TableNotFoundError,
  TableUnavailableError,
  type ComandaRepository,
} from "../comanda-repository.js";
import type { RestaurantTableRepository } from "../restaurant-table-repository.js";

interface TableParams {
  tableId: string;
}

export function registerRestaurantTableRoutes(
  app: FastifyInstance,
  restaurantTables: RestaurantTableRepository,
  comandas: ComandaRepository,
) {
  app.get("/tables", async (_request, reply) => {
    try {
      return {
        tables: await restaurantTables.list(),
      };
    } catch (error) {
      app.log.error(error, "Restaurant table query failed");

      return reply.code(503).send({
        status: "error",
        message: "Tables unavailable",
      });
    }
  });

  app.post<{ Params: TableParams }>("/tables/:tableId/comandas", async (request, reply) => {
    const tableId = Number(request.params.tableId);

    if (!Number.isInteger(tableId) || tableId <= 0) {
      return reply.code(404).send({
        status: "error",
        message: "Table not found",
      });
    }

    try {
      return reply.code(201).send({
        comanda: await comandas.openForTable(tableId),
      });
    } catch (error) {
      if (error instanceof TableNotFoundError) {
        return reply.code(404).send({
          status: "error",
          message: "Table not found",
        });
      }

      if (error instanceof TableUnavailableError) {
        return reply.code(409).send({
          status: "error",
          message: "Table unavailable",
        });
      }

      app.log.error(error, "Comanda opening failed");

      return reply.code(503).send({
        status: "error",
        message: "Comanda unavailable",
      });
    }
  });
}
