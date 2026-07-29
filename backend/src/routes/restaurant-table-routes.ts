import type { FastifyInstance } from "fastify";
import {
  TableNotFoundError,
  TableUnavailableError,
  type ComandaRepository,
} from "../comanda-repository.js";
import type { RestaurantTableRepository } from "../restaurant-table-repository.js";
import { requireAuthUser } from "../authentication.js";

interface TableParams {
  tableId: string;
}

interface OpenComandaBody {
  name?: unknown;
}

export function registerRestaurantTableRoutes(
  app: FastifyInstance,
  restaurantTables: RestaurantTableRepository,
  comandas: ComandaRepository,
) {
  app.get(
    "/tables",
    { config: { permission: "tables.read" } },
    async (request, reply) => {
    try {
      return {
        tables: await restaurantTables.list(
          requireAuthUser(request).establishment.id,
        ),
      };
    } catch (error) {
      app.log.error(error, "Restaurant table query failed");

      return reply.code(503).send({
        status: "error",
        message: "Tables unavailable",
      });
    }
    },
  );

  app.post<{ Body: OpenComandaBody; Params: TableParams }>(
    "/tables/:tableId/comandas",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      const tableId = Number(request.params.tableId);

      if (!Number.isInteger(tableId) || tableId <= 0) {
        return reply.code(404).send({
          status: "error",
          message: "Table not found",
        });
      }

      const rawName = request.body?.name;

      if (rawName !== undefined && typeof rawName !== "string") {
        return reply.code(409).send({
          status: "error",
          message: "Invalid comanda name",
        });
      }

      const name = rawName?.trim() || null;

      if (name && name.length > 80) {
        return reply.code(409).send({
          status: "error",
          message: "Invalid comanda name",
        });
      }

      try {
        return reply.code(201).send({
          comanda: await comandas.openForTable(
            requireAuthUser(request).establishment.id,
            tableId,
            name,
            requireAuthUser(request).id,
          ),
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
    },
  );
}
