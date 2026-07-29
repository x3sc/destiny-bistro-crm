import { type Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  IngredientConflictError,
  IngredientInputError,
  InventoryBalanceError,
  InventoryMovementConflictError,
  InventoryMovementInputError,
  InventoryStockNotFoundError,
  type CreateIngredientInput,
  type CreateMovementInput,
  type InventoryItem,
  type InventoryMovement,
  type InventoryRepository,
} from "./inventory-types.js";

export * from "./inventory-types.js";

const inventoryItemSelect = {
  id: true,
  ingredient: {
    select: {
      active: true,
      code: true,
      id: true,
      name: true,
      unit: true,
    },
  },
  minimumQuantity: true,
  quantity: true,
  updatedAt: true,
} satisfies Prisma.InventoryStockSelect;

type PersistedInventoryItem = Prisma.InventoryStockGetPayload<{
  select: typeof inventoryItemSelect;
}>;

export function createInventoryRepository(
  prisma: PrismaClient,
): InventoryRepository {
  return {
    async createIngredient(establishmentId, rawInput, actorUserId) {
      const input = normalizeIngredientInput(rawInput);

      try {
        return await prisma.$transaction(async (transaction) => {
          const ingredient = await transaction.ingredient.create({
            data: {
              code: input.code,
              establishmentId,
              name: input.name,
              unit: input.unit,
            },
            select: { id: true },
          });
          const stock = await transaction.inventoryStock.create({
            data: {
              establishmentId,
              ingredientId: ingredient.id,
              minimumQuantity: input.minimumQuantity,
            },
            select: inventoryItemSelect,
          });

          await transaction.auditLog.create({
            data: createAuditData({
              action: "INGREDIENT_CREATED",
              establishmentId,
              metadata: {
                code: input.code,
                minimumQuantity: input.minimumQuantity,
                unit: input.unit,
              },
              resourceId: ingredient.id,
              resourceType: "INGREDIENT",
              userId: actorUserId,
            }),
          });

          return mapInventoryItem(stock);
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new IngredientConflictError();
        }

        throw error;
      }
    },
    async createMovement(
      establishmentId,
      stockId,
      rawInput,
      actorUserId,
    ) {
      const input = normalizeMovementInput(rawInput);

      return prisma.$transaction(async (transaction) => {
        const stock = await transaction.inventoryStock.findFirst({
          select: {
            id: true,
            quantity: true,
          },
          where: {
            establishmentId,
            id: stockId,
          },
        });

        if (!stock) {
          throw new InventoryStockNotFoundError();
        }

        const balanceAfter = stock.quantity + input.quantityDelta;

        if (balanceAfter < 0) {
          throw new InventoryBalanceError();
        }

        const updated = await transaction.inventoryStock.updateMany({
          data: { quantity: balanceAfter },
          where: {
            establishmentId,
            id: stock.id,
            quantity: stock.quantity,
          },
        });

        if (updated.count !== 1) {
          throw new InventoryMovementConflictError();
        }

        const movement = await transaction.inventoryMovement.create({
          data: {
            actorUserId,
            balanceAfter,
            establishmentId,
            quantityDelta: input.quantityDelta,
            reason: input.reason,
            stockId: stock.id,
            type: input.type,
          },
          select: {
            balanceAfter: true,
            createdAt: true,
            id: true,
            quantityDelta: true,
            reason: true,
            stockId: true,
            type: true,
          },
        });

        await transaction.auditLog.create({
          data: createAuditData({
            action: "INVENTORY_MOVEMENT_RECORDED",
            establishmentId,
            metadata: {
              balanceAfter,
              quantityDelta: input.quantityDelta,
              reason: input.reason,
              type: input.type,
            },
            resourceId: stock.id,
            resourceType: "INVENTORY_STOCK",
            userId: actorUserId,
          }),
        });

        return mapMovement(movement);
      });
    },
    async list(establishmentId) {
      const stocks = await prisma.inventoryStock.findMany({
        orderBy: {
          ingredient: {
            name: "asc",
          },
        },
        select: inventoryItemSelect,
        where: { establishmentId },
      });

      return stocks.map(mapInventoryItem);
    },
  };
}

function normalizeIngredientInput(
  input: CreateIngredientInput,
): CreateIngredientInput {
  const code = input.code.trim().toLocaleUpperCase("pt-BR");
  const name = input.name.trim().replace(/\s+/gu, " ");

  if (
    !code ||
    code.length > 50 ||
    !name ||
    name.length > 100 ||
    !["UNIT", "GRAM", "MILLILITER"].includes(input.unit) ||
    !Number.isInteger(input.minimumQuantity) ||
    input.minimumQuantity < 0
  ) {
    throw new IngredientInputError();
  }

  return {
    code,
    minimumQuantity: input.minimumQuantity,
    name,
    unit: input.unit,
  };
}

function normalizeMovementInput(
  input: CreateMovementInput,
): CreateMovementInput {
  const reason = input.reason.trim().replace(/\s+/gu, " ");
  const validSign =
    (input.type === "ENTRY" && input.quantityDelta > 0) ||
    (input.type === "EXIT" && input.quantityDelta < 0) ||
    (input.type === "ADJUSTMENT" && input.quantityDelta !== 0);

  if (
    !["ENTRY", "EXIT", "ADJUSTMENT"].includes(input.type) ||
    !Number.isInteger(input.quantityDelta) ||
    !validSign ||
    reason.length < 2 ||
    reason.length > 255
  ) {
    throw new InventoryMovementInputError();
  }

  return {
    quantityDelta: input.quantityDelta,
    reason,
    type: input.type,
  };
}

function mapInventoryItem(stock: PersistedInventoryItem): InventoryItem {
  return {
    id: stock.id,
    ingredient: stock.ingredient,
    lowStock: stock.quantity <= stock.minimumQuantity,
    minimumQuantity: stock.minimumQuantity,
    quantity: stock.quantity,
    updatedAt: stock.updatedAt.toISOString(),
  };
}

function mapMovement(movement: {
  balanceAfter: number;
  createdAt: Date;
  id: string;
  quantityDelta: number;
  reason: string;
  stockId: string;
  type: "ENTRY" | "EXIT" | "ADJUSTMENT";
}): InventoryMovement {
  return {
    ...movement,
    createdAt: movement.createdAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
