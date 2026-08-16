import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  IngredientConflictError,
  IngredientInputError,
  InventoryBalanceError,
  InventoryMovementConflictError,
  InventoryMovementInputError,
  InventoryRequestConflictError,
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
  requestId?: unknown;
  type?: unknown;
}

interface CreateEntryBody {
  code?: unknown;
  expiresAt?: unknown;
  quantity?: unknown;
  reason?: unknown;
  receivedAt?: unknown;
  requestId?: unknown;
  totalCostCents?: unknown;
  unit?: unknown;
}

interface UpdateIngredientBody extends CreateIngredientBody {
  active?: unknown;
}

interface StockParams {
  stockId: string;
}

interface IngredientParams {
  ingredientId: string;
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

  app.patch<{ Body: UpdateIngredientBody; Params: IngredientParams }>(
    "/ingredients/:ingredientId",
    { config: { permission: "inventory.write" } },
    async (request, reply) => {
      if (!isUpdateIngredientBody(request.body)) {
        return invalidIngredient(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          inventoryItem: await inventory.updateIngredient(
            user.establishment.id,
            request.params.ingredientId,
            {
              active: request.body.active,
              code: request.body.code,
              minimumQuantity: request.body.minimumQuantity,
              name: request.body.name,
              unit: request.body.unit as "UNIT" | "GRAM" | "MILLILITER",
            },
            user.id,
          ),
        };
      } catch (error) {
        return handleIngredientError(app, reply, error);
      }
    },
  );

  app.delete<{ Params: IngredientParams }>(
    "/ingredients/:ingredientId",
    { config: { permission: "inventory.write" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          inventoryItem: await inventory.deactivateIngredient(
            user.establishment.id,
            request.params.ingredientId,
            user.id,
          ),
        };
      } catch (error) {
        return handleIngredientError(app, reply, error);
      }
    },
  );

  app.get<{ Params: StockParams }>(
    "/inventory/:stockId/lots",
    { config: { permission: "inventory.read" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          lots: await inventory.listLots(
            user.establishment.id,
            request.params.stockId,
          ),
        };
      } catch (error) {
        if (error instanceof InventoryStockNotFoundError) {
          return reply.code(404).send({ message: "Inventory stock not found", status: "error" });
        }
        app.log.error(error, "Inventory lots query failed");
        return reply.code(503).send({ message: "Inventory unavailable", status: "error" });
      }
    },
  );

  app.get<{ Params: StockParams }>(
    "/inventory/:stockId/movements",
    { config: { permission: "inventory.read" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          movements: await inventory.listMovements(
            user.establishment.id,
            request.params.stockId,
          ),
        };
      } catch (error) {
        if (error instanceof InventoryStockNotFoundError) {
          return reply.code(404).send({ message: "Inventory stock not found", status: "error" });
        }
        app.log.error(error, "Inventory movement query failed");
        return reply.code(503).send({ message: "Inventory unavailable", status: "error" });
      }
    },
  );

  app.post<{ Body: CreateEntryBody; Params: StockParams }>(
    "/inventory/:stockId/entries",
    { config: { permission: "inventory.write" } },
    async (request, reply) => {
      if (!isEntryBody(request.body)) {
        return invalidMovement(reply);
      }
      try {
        const user = requireAuthUser(request);
        const result = await inventory.createEntry(
          user.establishment.id,
          request.params.stockId,
          {
            code: request.body.code,
            expiresAt: request.body.expiresAt,
            quantity: request.body.quantity,
            reason: request.body.reason,
            receivedAt: request.body.receivedAt,
            requestId: request.body.requestId,
            totalCostCents: request.body.totalCostCents,
            unit: request.body.unit as "UNIT" | "GRAM" | "KILOGRAM" | "MILLILITER" | "LITER",
          },
          user.id,
        );
        return reply.code(result.replayed ? 200 : 201).send(result);
      } catch (error) {
        if (error instanceof InventoryMovementInputError) {
          return invalidMovement(reply);
        }
        if (error instanceof InventoryStockNotFoundError) {
          return reply.code(404).send({ message: "Inventory stock not found", status: "error" });
        }
        if (error instanceof InventoryRequestConflictError) {
          return reply.code(409).send({ message: "Idempotency key already used", status: "error" });
        }
        app.log.error(error, "Inventory entry failed");
        return reply.code(503).send({ message: "Inventory entry unavailable", status: "error" });
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
        typeof request.body.requestId !== "string" ||
        typeof request.body.type !== "string"
      ) {
        return invalidMovement(reply);
      }

      try {
        const user = requireAuthUser(request);

        const result = await inventory.createMovement(
            user.establishment.id,
            request.params.stockId,
            {
              quantityDelta: request.body.quantityDelta,
              reason: request.body.reason,
              requestId: request.body.requestId,
              type: request.body.type as "EXIT" | "LOSS" | "ADJUSTMENT",
            },
            user.id,
          );
        return reply.code(result.replayed ? 200 : 201).send(result);
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

        if (error instanceof InventoryRequestConflictError) {
          return reply.code(409).send({ message: "Idempotency key already used", status: "error" });
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

function isUpdateIngredientBody(
  body: UpdateIngredientBody | undefined,
): body is UpdateIngredientBody & {
  active: boolean;
  code: string;
  minimumQuantity: number;
  name: string;
  unit: string;
} {
  return Boolean(
    body &&
      typeof body.active === "boolean" &&
      typeof body.code === "string" &&
      typeof body.minimumQuantity === "number" &&
      typeof body.name === "string" &&
      typeof body.unit === "string",
  );
}

function isEntryBody(
  body: CreateEntryBody | undefined,
): body is CreateEntryBody & {
  code: string | null;
  expiresAt: string | null;
  quantity: string;
  reason: string;
  receivedAt: string;
  requestId: string;
  totalCostCents: number;
  unit: string;
} {
  return Boolean(
    body &&
      (body.code === null || typeof body.code === "string") &&
      (body.expiresAt === null || typeof body.expiresAt === "string") &&
      typeof body.quantity === "string" &&
      typeof body.reason === "string" &&
      typeof body.receivedAt === "string" &&
      typeof body.requestId === "string" &&
      typeof body.totalCostCents === "number" &&
      typeof body.unit === "string",
  );
}

function handleIngredientError(
  app: FastifyInstance,
  reply: {
    code(statusCode: number): { send(payload: unknown): unknown };
  },
  error: unknown,
) {
  if (error instanceof IngredientInputError) {
    return invalidIngredient(reply);
  }
  if (error instanceof IngredientConflictError) {
    return reply.code(409).send({ message: "Ingredient code already exists", status: "error" });
  }
  if (error instanceof InventoryStockNotFoundError) {
    return reply.code(404).send({ message: "Ingredient not found", status: "error" });
  }
  app.log.error(error, "Ingredient update failed");
  return reply.code(503).send({ message: "Ingredient unavailable", status: "error" });
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
