import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  IngredientConflictError,
  IngredientInputError,
  InventoryBalanceError,
  InventoryMovementInputError,
  InventoryRequestConflictError,
  InventoryStockNotFoundError,
  type CreateEntryInput,
  type CreateIngredientInput,
  type CreateMovementInput,
  type InventoryEntryResult,
  type InventoryItem,
  type InventoryLot,
  type InventoryMovement,
  type InventoryMovementResult,
  type InventoryRepository,
  type UpdateIngredientInput,
} from "./inventory-types.js";

export * from "./inventory-types.js";

const inventoryItemSelect = {
  deficitQuantity: true,
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
      try {
        return await prisma.$transaction(async (transaction) => {
          const replay = await findManualMovementReplay(
            transaction,
            establishmentId,
            input.requestId,
          );
          if (replay) {
            return replayManualMovement(replay, stockId, input, true);
          }

          await transaction.$queryRaw(
            Prisma.sql`SELECT id FROM InventoryStock WHERE establishmentId = ${establishmentId} AND id = ${stockId} FOR UPDATE`,
          );
          const stock = await transaction.inventoryStock.findFirst({
            include: {
              lots: {
                where: {
                  currentQuantity: { gt: 0 },
                  ...(input.type === "LOSS"
                    ? {}
                    : { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }),
                },
              },
            },
            where: { establishmentId, id: stockId },
          });
          if (!stock) {
            throw new InventoryStockNotFoundError();
          }

          const balanceAfter = stock.quantity + input.quantityDelta;
          if (balanceAfter < 0) {
            throw new InventoryBalanceError();
          }
          if (
            input.quantityDelta < 0 &&
            input.type !== "LOSS" &&
            stock.lots.reduce(
              (total, lot) => total + lot.currentQuantity,
              0,
            ) < Math.abs(input.quantityDelta)
          ) {
            throw new InventoryBalanceError();
          }

          const operation = await transaction.inventoryOperation.create({
            data: {
              actorUserId,
              establishmentId,
              reason: input.reason,
              requestId: input.requestId,
              sourceId: stockId,
              type: "MANUAL",
            },
          });
          const deficitCovered =
            input.quantityDelta > 0
              ? Math.min(stock.deficitQuantity, input.quantityDelta)
              : 0;
          const lotQuantity =
            input.quantityDelta > 0 ? input.quantityDelta - deficitCovered : 0;
          const adjustmentLot = lotQuantity
            ? await transaction.inventoryLot.create({
                data: {
                  actorUserId,
                  currentQuantity: lotQuantity,
                  establishmentId,
                  initialQuantity: lotQuantity,
                  origin: "ADJUSTMENT",
                  receivedAt: new Date(),
                  stockId,
                },
              })
            : null;
          const movement = await transaction.inventoryMovement.create({
            data: {
              actorUserId,
              balanceAfter,
              balanceBefore: stock.quantity,
              establishmentId,
              operationId: operation.id,
              quantityDelta: input.quantityDelta,
              reason: input.reason,
              stockId: stock.id,
              type: input.type,
            },
          });

          if (adjustmentLot) {
            await transaction.inventoryMovementLot.create({
              data: {
                establishmentId,
                lotId: adjustmentLot.id,
                movementId: movement.id,
                quantityDelta: lotQuantity,
              },
            });
          } else if (input.quantityDelta < 0) {
            let remaining = Math.abs(input.quantityDelta);
            const lots = stock.lots.sort(compareInventoryLots);
            for (const lot of lots) {
              if (remaining === 0) break;
              const allocated = Math.min(lot.currentQuantity, remaining);
              await transaction.inventoryLot.update({
                data: { currentQuantity: { decrement: allocated } },
                where: { id: lot.id },
              });
              await transaction.inventoryMovementLot.create({
                data: {
                  establishmentId,
                  lotId: lot.id,
                  movementId: movement.id,
                  quantityDelta: -allocated,
                },
              });
              remaining -= allocated;
            }
          }

          await transaction.inventoryStock.update({
            data: {
              deficitQuantity:
                deficitCovered > 0 ? { decrement: deficitCovered } : undefined,
              quantity: balanceAfter,
            },
            where: { id: stock.id },
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "INVENTORY_MOVEMENT_RECORDED",
              establishmentId,
              metadata: {
                balanceAfter,
                quantityDelta: input.quantityDelta,
                reason: input.reason,
                requestId: input.requestId,
                type: input.type,
              },
              resourceId: stock.id,
              resourceType: "INVENTORY_STOCK",
              userId: actorUserId,
            }),
          });
          return { movement: mapMovement(movement), replayed: false };
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const replay = await prisma.$transaction((transaction) =>
            findManualMovementReplay(transaction, establishmentId, input.requestId),
          );
          if (replay) {
            return replayManualMovement(replay, stockId, input, true);
          }
        }
        throw error;
      }
    },
    async createEntry(establishmentId, stockId, rawInput, actorUserId) {
      const input = normalizeEntryInput(rawInput);

      try {
        return await prisma.$transaction(async (transaction) => {
          const replay = await findEntryReplay(
            transaction,
            establishmentId,
            input.requestId,
          );
          if (replay) {
            assertEntryReplay(replay, stockId, input);
            return replayEntry(transaction, establishmentId, replay, true);
          }

          const stock = await transaction.inventoryStock.findFirst({
            select: {
              deficitQuantity: true,
              id: true,
              ingredient: { select: { unit: true } },
              quantity: true,
            },
            where: { establishmentId, id: stockId },
          });
          if (!stock) {
            throw new InventoryStockNotFoundError();
          }

          const quantity = quantityToBase(
            input.quantity,
            input.unit,
            stock.ingredient.unit,
          );
          const operation = await transaction.inventoryOperation.create({
            data: {
              actorUserId,
              establishmentId,
              reason: input.reason,
              requestId: input.requestId,
              sourceId: stockId,
              type: "ENTRY",
            },
            select: { id: true },
          });
          const deficitCovered = Math.min(stock.deficitQuantity, quantity);
          const lot = await transaction.inventoryLot.create({
            data: {
              actorUserId,
              code: input.code,
              currentQuantity: quantity - deficitCovered,
              establishmentId,
              expiresAt: input.expiresAt,
              initialQuantity: quantity,
              origin: "PURCHASE",
              receivedAt: input.receivedAt,
              stockId,
              totalCostCents: input.totalCostCents,
            },
          });
          const balanceAfter = stock.quantity + quantity;
          await transaction.inventoryStock.update({
            data: {
              deficitQuantity: { decrement: deficitCovered },
              quantity: { increment: quantity },
            },
            where: { id: stockId },
          });
          const movement = await transaction.inventoryMovement.create({
            data: {
              actorUserId,
              balanceAfter,
              balanceBefore: stock.quantity,
              establishmentId,
              operationId: operation.id,
              quantityDelta: quantity,
              reason: input.reason,
              stockId,
              type: "ENTRY",
            },
          });
          await transaction.inventoryMovementLot.create({
            data: {
              establishmentId,
              lotId: lot.id,
              movementId: movement.id,
              quantityDelta: quantity,
            },
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "INVENTORY_ENTRY_RECORDED",
              establishmentId,
              metadata: {
                deficitCovered,
                expiresAt: input.expiresAt?.toISOString() ?? null,
                quantity,
                requestId: input.requestId,
                totalCostCents: input.totalCostCents,
              },
              resourceId: lot.id,
              resourceType: "INVENTORY_LOT",
              userId: actorUserId,
            }),
          });

          const inventoryItem = await transaction.inventoryStock.findUniqueOrThrow({
            select: inventoryItemSelect,
            where: { id: stockId },
          });
          return {
            inventoryItem: mapInventoryItem(inventoryItem),
            lot: mapLot(lot),
            movement: mapMovement(movement),
            replayed: false,
          };
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const replay = await prisma.$transaction((transaction) =>
            findEntryReplay(transaction, establishmentId, input.requestId),
          );
          if (replay) {
            assertEntryReplay(replay, stockId, input);
            return prisma.$transaction((transaction) =>
              replayEntry(transaction, establishmentId, replay, true),
            );
          }
        }
        throw error;
      }
    },
    async deactivateIngredient(establishmentId, ingredientId, actorUserId) {
      return updateIngredientRecord(
        prisma,
        establishmentId,
        ingredientId,
        { active: false },
        actorUserId,
      );
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
    async listLots(establishmentId, stockId) {
      await assertStockExists(prisma, establishmentId, stockId);
      const lots = await prisma.inventoryLot.findMany({
        orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
        where: { establishmentId, stockId },
      });
      return lots.map(mapLot);
    },
    async listMovements(establishmentId, stockId, pagination) {
      await assertStockExists(prisma, establishmentId, stockId);
      const where = { establishmentId, stockId };
      const [movements, total] = await prisma.$transaction([
        prisma.inventoryMovement.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (pagination.page - 1) * pagination.pageSize,
          take: pagination.pageSize,
          where,
        }),
        prisma.inventoryMovement.count({ where }),
      ]);
      return {
        movements: movements.map(mapMovement),
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
      };
    },
    async updateIngredient(
      establishmentId,
      ingredientId,
      rawInput,
      actorUserId,
    ) {
      const input = normalizeUpdateIngredientInput(rawInput);
      try {
        return await prisma.$transaction(async (transaction) => {
          const current = await transaction.ingredient.findFirst({
            select: {
              stock: {
                select: { id: true, movements: { select: { id: true }, take: 1 } },
              },
              unit: true,
            },
            where: { establishmentId, id: ingredientId },
          });
          if (!current?.stock) {
            throw new InventoryStockNotFoundError();
          }
          if (current.unit !== input.unit && current.stock.movements.length > 0) {
            throw new IngredientInputError();
          }
          await transaction.ingredient.update({
            data: {
              active: input.active,
              code: input.code,
              name: input.name,
              unit: input.unit,
            },
            where: { id: ingredientId },
          });
          const stock = await transaction.inventoryStock.update({
            data: { minimumQuantity: input.minimumQuantity },
            select: inventoryItemSelect,
            where: { id: current.stock.id },
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "INGREDIENT_UPDATED",
              establishmentId,
              metadata: {
                active: input.active,
                code: input.code,
                minimumQuantity: input.minimumQuantity,
                name: input.name,
                unit: input.unit,
              },
              resourceId: ingredientId,
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

function normalizeUpdateIngredientInput(
  input: UpdateIngredientInput,
): UpdateIngredientInput {
  if (typeof input.active !== "boolean") {
    throw new IngredientInputError();
  }
  return {
    ...normalizeIngredientInput(input),
    active: input.active,
  };
}

function normalizeEntryInput(input: CreateEntryInput) {
  const code = input.code?.trim().replace(/\s+/gu, " ") || null;
  const reason = input.reason.trim().replace(/\s+/gu, " ");
  const receivedAt = parseDate(input.receivedAt);
  const expiresAt = input.expiresAt ? parseDate(input.expiresAt) : null;
  if (
    !/^[a-zA-Z0-9_-]{8,191}$/u.test(input.requestId) ||
    (code?.length ?? 0) > 80 ||
    reason.length < 2 ||
    reason.length > 255 ||
    !Number.isInteger(input.totalCostCents) ||
    input.totalCostCents <= 0 ||
    (expiresAt !== null && expiresAt < receivedAt)
  ) {
    throw new InventoryMovementInputError();
  }
  return { ...input, code, expiresAt, reason, receivedAt };
}

export function quantityToBase(
  rawQuantity: string,
  inputUnit: CreateEntryInput["unit"],
  baseUnit: "UNIT" | "GRAM" | "MILLILITER",
) {
  const normalized = rawQuantity.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,3})?$/u.test(normalized)) {
    throw new InventoryMovementInputError();
  }
  const [whole, fraction = ""] = normalized.split(".");
  const thousandths = Number(whole) * 1_000 + Number(fraction.padEnd(3, "0"));
  const compatible =
    (baseUnit === "UNIT" && inputUnit === "UNIT") ||
    (baseUnit === "GRAM" && ["GRAM", "KILOGRAM"].includes(inputUnit)) ||
    (baseUnit === "MILLILITER" && ["MILLILITER", "LITER"].includes(inputUnit));
  if (!compatible) {
    throw new InventoryMovementInputError();
  }
  const multiplier = ["KILOGRAM", "LITER"].includes(inputUnit) ? 1_000 : 1;
  const scaled = thousandths * multiplier;
  if (scaled % 1_000 !== 0 || scaled <= 0 || !Number.isSafeInteger(scaled / 1_000)) {
    throw new InventoryMovementInputError();
  }
  return scaled / 1_000;
}

function parseDate(raw: string) {
  const value = new Date(raw);
  if (!raw || Number.isNaN(value.getTime())) {
    throw new InventoryMovementInputError();
  }
  return value;
}

async function assertStockExists(
  prisma: PrismaClient,
  establishmentId: string,
  stockId: string,
) {
  const stock = await prisma.inventoryStock.findFirst({
    select: { id: true },
    where: { establishmentId, id: stockId },
  });
  if (!stock) {
    throw new InventoryStockNotFoundError();
  }
}

async function updateIngredientRecord(
  prisma: PrismaClient,
  establishmentId: string,
  ingredientId: string,
  data: { active: boolean },
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const ingredient = await transaction.ingredient.findFirst({
      select: { stock: { select: { id: true } } },
      where: { establishmentId, id: ingredientId },
    });
    if (!ingredient?.stock) {
      throw new InventoryStockNotFoundError();
    }
    await transaction.ingredient.update({
      data,
      where: { id: ingredientId },
    });
    await transaction.auditLog.create({
      data: createAuditData({
        action: data.active ? "INGREDIENT_ACTIVATED" : "INGREDIENT_DEACTIVATED",
        establishmentId,
        resourceId: ingredientId,
        resourceType: "INGREDIENT",
        userId: actorUserId,
      }),
    });
    return mapInventoryItem(
      await transaction.inventoryStock.findUniqueOrThrow({
        select: inventoryItemSelect,
        where: { id: ingredient.stock.id },
      }),
    );
  });
}

async function findEntryReplay(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  requestId: string,
) {
  return transaction.inventoryOperation.findUnique({
    include: {
      movements: {
        include: {
          lotAllocations: { include: { lot: true }, take: 1 },
          stock: { include: { ingredient: { select: { unit: true } } } },
        },
        take: 1,
      },
    },
    where: { establishmentId_requestId: { establishmentId, requestId } },
  });
}

async function findManualMovementReplay(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  requestId: string,
) {
  return transaction.inventoryOperation.findUnique({
    include: { movements: { take: 1 } },
    where: { establishmentId_requestId: { establishmentId, requestId } },
  });
}

function replayManualMovement(
  replay: NonNullable<Awaited<ReturnType<typeof findManualMovementReplay>>>,
  stockId: string,
  input: ReturnType<typeof normalizeMovementInput>,
  replayed: boolean,
): InventoryMovementResult {
  const movement = replay.movements[0];
  if (
    replay.type !== "MANUAL" ||
    replay.sourceId !== stockId ||
    !movement ||
    movement.stockId !== stockId ||
    movement.quantityDelta !== input.quantityDelta ||
    movement.reason !== input.reason ||
    movement.type !== input.type
  ) {
    throw new InventoryRequestConflictError();
  }
  return { movement: mapMovement(movement), replayed };
}

function assertEntryReplay(
  replay: NonNullable<Awaited<ReturnType<typeof findEntryReplay>>>,
  stockId: string,
  input: ReturnType<typeof normalizeEntryInput>,
) {
  const movement = replay.movements[0];
  const lot = movement?.lotAllocations[0]?.lot;
  const expectedQuantity = movement
    ? quantityToBase(input.quantity, input.unit, movement.stock.ingredient.unit)
    : null;
  if (
    replay.type !== "ENTRY" ||
    replay.sourceId !== stockId ||
    !movement ||
    !lot ||
    movement.quantityDelta !== expectedQuantity ||
    lot.code !== input.code ||
    lot.totalCostCents !== input.totalCostCents ||
    lot.receivedAt.getTime() !== input.receivedAt.getTime() ||
    lot.expiresAt?.getTime() !== input.expiresAt?.getTime()
  ) {
    throw new InventoryRequestConflictError();
  }
}

async function replayEntry(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  replay: NonNullable<Awaited<ReturnType<typeof findEntryReplay>>>,
  replayed: boolean,
): Promise<InventoryEntryResult> {
  const movement = replay.movements[0];
  const lot = movement?.lotAllocations[0]?.lot;
  if (!movement || !lot || movement.establishmentId !== establishmentId) {
    throw new InventoryRequestConflictError();
  }
  const stock = await transaction.inventoryStock.findUniqueOrThrow({
    select: inventoryItemSelect,
    where: { id: movement.stockId },
  });
  return {
    inventoryItem: mapInventoryItem(stock),
    lot: mapLot(lot),
    movement: mapMovement(movement),
    replayed,
  };
}

function normalizeMovementInput(
  input: CreateMovementInput,
): CreateMovementInput {
  const reason = input.reason.trim().replace(/\s+/gu, " ");
  const validSign =
    (input.type === "EXIT" && input.quantityDelta < 0) ||
    (input.type === "LOSS" && input.quantityDelta < 0) ||
    (input.type === "ADJUSTMENT" && input.quantityDelta !== 0);

  if (
    !/^[a-zA-Z0-9_-]{8,191}$/u.test(input.requestId) ||
    !["EXIT", "LOSS", "ADJUSTMENT"].includes(input.type) ||
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
    requestId: input.requestId,
    type: input.type,
  };
}

function compareInventoryLots(
  a: { expiresAt: Date | null; id: string; receivedAt: Date },
  b: { expiresAt: Date | null; id: string; receivedAt: Date },
) {
  const expirationA = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const expirationB = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return (
    expirationA - expirationB ||
    a.receivedAt.getTime() - b.receivedAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

function mapInventoryItem(stock: PersistedInventoryItem): InventoryItem {
  return {
    deficitQuantity: stock.deficitQuantity,
    id: stock.id,
    ingredient: stock.ingredient,
    lowStock: stock.quantity <= stock.minimumQuantity,
    minimumQuantity: stock.minimumQuantity,
    quantity: stock.quantity,
    updatedAt: stock.updatedAt.toISOString(),
  };
}

function mapLot(lot: {
  code: string | null;
  createdAt: Date;
  currentQuantity: number;
  expiresAt: Date | null;
  id: string;
  initialQuantity: number;
  origin: "PURCHASE" | "ADJUSTMENT" | "REVERSAL" | "LEGACY";
  receivedAt: Date;
  stockId: string;
  totalCostCents: number | null;
}): InventoryLot {
  return {
    ...lot,
    createdAt: lot.createdAt.toISOString(),
    expiresAt: lot.expiresAt?.toISOString() ?? null,
    expired: Boolean(lot.expiresAt && lot.expiresAt.getTime() < Date.now()),
    receivedAt: lot.receivedAt.toISOString(),
  };
}

function mapMovement(movement: {
  balanceAfter: number;
  balanceBefore: number;
  createdAt: Date;
  id: string;
  quantityDelta: number;
  reason: string;
  stockId: string;
  type: InventoryMovement["type"];
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
