import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  IngredientConflictError,
  IngredientInputError,
  InventoryBalanceError,
  InventoryMovementConflictError,
  InventoryMovementInputError,
  InventoryStockNotFoundError,
  type InventoryRepository,
} from "../inventory-repository.js";

interface CreateIngredientBody {
  code?: unknown;
  minimumQuantity?: unknown;
  name?: unknown;
  unit?: unknown;
}

interface CreateMovementBody {
  quantityDelta?: unknown;
  reason?: unknown;
  type?: unknown;
}

interface StockParams {
  stockId: string;
}

export function registerInventoryRoutes(
  app: FastifyInstance,
  inventory: InventoryRepository,
) {
  app.get(
    "/inventory",
    { config: { permission: "inventory.read" } },
    async (request, reply) => {
      try {
        return {
          inventory: await inventory.list(
            requireAuthUser(request).establishment.id,
          ),
        };
      } catch (error) {
        app.log.error(error, "Inventory query failed");

        return reply.code(503).send({
          message: "Inventory unavailable",
          status: "error",
        });
      }
    },
  );

  app.post<{ Body: CreateIngredientBody }>(
    "/ingredients",
    { config: { permission: "inventory.write" } },
    async (request, reply) => {
      if (
        !request.body ||
        typeof request.body.code !== "string" ||
        typeof request.body.minimumQuantity !== "number" ||
        typeof request.body.name !== "string" ||
        typeof request.body.unit !== "string"
      ) {
        return invalidIngredient(reply);
      }

      try {
        const user = requireAuthUser(request);

        return reply.code(201).send({
          inventoryItem: await inventory.createIngredient(
            user.establishment.id,
            {
              code: request.body.code,
              minimumQuantity: request.body.minimumQuantity,
              name: request.body.name,
              unit: request.body.unit as "UNIT" | "GRAM" | "MILLILITER",
            },
            user.id,
          ),
        });
      } catch (error) {
        if (error instanceof IngredientInputError) {
          return invalidIngredient(reply);
        }

        if (error instanceof IngredientConflictError) {
          return reply.code(409).send({
            message: "Ingredient code already exists",
            status: "error",
          });
        }

        app.log.error(error, "Ingredient creation failed");

        return reply.code(503).send({
          message: "Ingredient unavailable",
          status: "error",
        });
      }
    },
  );

  app.post<{ Body: CreateMovementBody; Params: StockParams }>(
    "/inventory/:stockId/movements",
    { config: { permission: "inventory.write" } },
    async (request, reply) => {
      if (
        !request.body ||
        typeof request.body.quantityDelta !== "number" ||
        typeof request.body.reason !== "string" ||
        typeof request.body.type !== "string"
      ) {
        return invalidMovement(reply);
      }

      try {
        const user = requireAuthUser(request);

        return reply.code(201).send({
          movement: await inventory.createMovement(
            user.establishment.id,
            request.params.stockId,
            {
              quantityDelta: request.body.quantityDelta,
              reason: request.body.reason,
              type: request.body.type as "ENTRY" | "EXIT" | "ADJUSTMENT",
            },
            user.id,
          ),
        });
      } catch (error) {
        if (error instanceof InventoryMovementInputError) {
          return invalidMovement(reply);
        }

        if (error instanceof InventoryStockNotFoundError) {
          return reply.code(404).send({
            message: "Inventory stock not found",
            status: "error",
          });
        }

        if (error instanceof InventoryBalanceError) {
          return reply.code(409).send({
            message: "Inventory balance cannot be negative",
            status: "error",
          });
        }

        if (error instanceof InventoryMovementConflictError) {
          return reply.code(409).send({
            message: "Inventory changed; retry the movement",
            status: "error",
          });
        }

        app.log.error(error, "Inventory movement failed");

        return reply.code(503).send({
          message: "Inventory movement unavailable",
          status: "error",
        });
      }
    },
  );
}

function invalidIngredient(reply: {
  code(statusCode: number): {
    send(payload: { message: string; status: string }): unknown;
  };
}) {
  return reply.code(409).send({
    message: "Invalid ingredient",
    status: "error",
  });
}

function invalidMovement(reply: {
  code(statusCode: number): {
    send(payload: { message: string; status: string }): unknown;
  };
}) {
  return reply.code(409).send({
    message: "Invalid inventory movement",
    status: "error",
  });
}
