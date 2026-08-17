import { Prisma } from "./generated/prisma/client.js";
import type { InventoryWarning } from "./comanda-types.js";
import type { Transaction } from "./comanda-persistence.js";

interface Requirement {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: "UNIT" | "GRAM" | "MILLILITER";
}

export async function consumePendingItemInventory(
  transaction: Transaction,
  input: {
    actorUserId: string;
    comandaId: string;
    establishmentId: string;
    itemId: string;
    newConfirmedQuantity: number;
    previousConfirmedQuantity: number;
    productId: string;
    productName: string;
  },
) {
  const configurations = await transaction.comandaItemConfiguration.findMany({
    include: {
      additionals: {
        include: {
          additional: {
            include: {
              ingredients: {
                include: { ingredient: true },
              },
            },
          },
        },
      },
      comandaItem: {
        include: {
          product: {
            include: {
              ingredients: { include: { ingredient: true } },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
    where: {
      comandaItemId: input.itemId,
      establishmentId: input.establishmentId,
      quantity: { gt: 0 },
    },
  });
  const pendingConfigurations = configurations.filter(
    (configuration) =>
      configuration.quantity > configuration.confirmedQuantity,
  );
  if (pendingConfigurations.length === 0) {
    return [] satisfies InventoryWarning[];
  }

  const requestId = `CONFIRM:${input.itemId}:${input.previousConfirmedQuantity}:${input.newConfirmedQuantity}`;
  const existingOperation = await transaction.inventoryOperation.findUnique({
    select: { id: true },
    where: {
      establishmentId_requestId: {
        establishmentId: input.establishmentId,
        requestId,
      },
    },
  });
  if (existingOperation) {
    return [] satisfies InventoryWarning[];
  }

  const warnings: InventoryWarning[] = [];
  const requirements = new Map<string, Requirement>();
  for (const configuration of pendingConfigurations) {
    const pendingQuantity =
      configuration.quantity - configuration.confirmedQuantity;
    const productRecipe = configuration.comandaItem.product.ingredients;
    if (productRecipe.length === 0) {
      warnings.push({
        productId: input.productId,
        productName: input.productName,
        type: "MISSING_RECIPE",
      });
    }
    for (const recipe of productRecipe) {
      addRequirement(requirements, {
        ingredientId: recipe.ingredientId,
        ingredientName: recipe.ingredient.name,
        quantity: recipe.quantity * pendingQuantity,
        unit: recipe.ingredient.unit,
      });
    }
    for (const orderAdditional of configuration.additionals) {
      const additionalRecipe = orderAdditional.additional.ingredients;
      if (additionalRecipe.length === 0) {
        warnings.push({
          productId: orderAdditional.additionalId,
          productName: orderAdditional.additionalName,
          type: "MISSING_RECIPE",
        });
      }
      for (const recipe of additionalRecipe) {
        addRequirement(requirements, {
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredient.name,
          quantity:
            recipe.quantity *
            orderAdditional.quantityPerUnit *
            pendingQuantity,
          unit: recipe.ingredient.unit,
        });
      }
    }
  }

  const operation = await transaction.inventoryOperation.create({
    data: {
      actorUserId: input.actorUserId,
      comandaId: input.comandaId,
      establishmentId: input.establishmentId,
      reason: `Confirmação de ${input.productName}`,
      requestId,
      sourceId: input.itemId,
      type: "CONFIRMATION",
    },
    select: { id: true },
  });
  const orderedRequirements = [...requirements.values()].sort((a, b) =>
    a.ingredientId.localeCompare(b.ingredientId),
  );
  if (orderedRequirements.length > 0) {
    await lockStocks(
      transaction,
      input.establishmentId,
      orderedRequirements.map(({ ingredientId }) => ingredientId),
    );
  }
  for (const requirement of orderedRequirements) {
    const stock = await transaction.inventoryStock.findFirstOrThrow({
      include: {
        lots: {
          where: {
            currentQuantity: { gt: 0 },
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        },
      },
      where: {
        establishmentId: input.establishmentId,
        ingredientId: requirement.ingredientId,
      },
    });
    const lots = stock.lots.sort(compareLotsForFefo);
    const availableQuantity = lots.reduce(
      (total, lot) => total + lot.currentQuantity,
      0,
    );
    if (availableQuantity < requirement.quantity) {
      warnings.push({
        availableQuantity,
        ingredientId: requirement.ingredientId,
        ingredientName: requirement.ingredientName,
        missingQuantity: requirement.quantity - availableQuantity,
        type: "INSUFFICIENT_STOCK",
        unit: requirement.unit,
      });
    }
    const balanceBefore = stock.quantity;
    const balanceAfter = balanceBefore - requirement.quantity;
    const movement = await transaction.inventoryMovement.create({
      data: {
        actorUserId: input.actorUserId,
        balanceAfter,
        balanceBefore,
        establishmentId: input.establishmentId,
        operationId: operation.id,
        quantityDelta: -requirement.quantity,
        reason: `Consumo confirmado: ${input.productName}`,
        stockId: stock.id,
        type: "SALE_CONSUMPTION",
      },
      select: { id: true },
    });
    let remaining = requirement.quantity;
    for (const lot of lots) {
      if (remaining === 0) {
        break;
      }
      const allocated = Math.min(lot.currentQuantity, remaining);
      await transaction.inventoryLot.update({
        data: { currentQuantity: { decrement: allocated } },
        where: { id: lot.id },
      });
      await transaction.inventoryMovementLot.create({
        data: {
          establishmentId: input.establishmentId,
          lotId: lot.id,
          movementId: movement.id,
          quantityDelta: -allocated,
        },
      });
      remaining -= allocated;
    }
    await transaction.inventoryStock.update({
      data: {
        deficitQuantity:
          remaining > 0 ? { increment: remaining } : undefined,
        quantity: { decrement: requirement.quantity },
      },
      where: { id: stock.id },
    });
  }

  for (const configuration of pendingConfigurations) {
    const updated = await transaction.comandaItemConfiguration.updateMany({
      data: { confirmedQuantity: configuration.quantity },
      where: {
        confirmedQuantity: configuration.confirmedQuantity,
        id: configuration.id,
        quantity: configuration.quantity,
      },
    });
    if (updated.count !== 1) {
      throw new Error("Inventory confirmation conflict");
    }
  }
  return deduplicateWarnings(warnings);
}

export async function reverseConfigurationInventory(
  transaction: Transaction,
  input: {
    actorUserId: string;
    comandaId: string;
    configurationId: string;
    disposition: "RETURN_TO_STOCK" | "LOSS";
    establishmentId: string;
    itemId: string;
    productName: string;
    quantity: number;
    reason: string;
    requestId: string;
  },
) {
  const existing = await transaction.inventoryOperation.findUnique({
    select: { id: true },
    where: {
      establishmentId_requestId: {
        establishmentId: input.establishmentId,
        requestId: input.requestId,
      },
    },
  });
  if (existing) {
    return;
  }
  const configuration = await transaction.comandaItemConfiguration.findFirstOrThrow({
    include: {
      additionals: {
        include: {
          additional: {
            include: {
              ingredients: { include: { ingredient: true } },
            },
          },
        },
      },
      comandaItem: {
        include: {
          product: {
            include: { ingredients: { include: { ingredient: true } } },
          },
        },
      },
    },
    where: {
      comandaItemId: input.itemId,
      establishmentId: input.establishmentId,
      id: input.configurationId,
    },
  });
  const requirements = new Map<string, Requirement>();
  for (const recipe of configuration.comandaItem.product.ingredients) {
    addRequirement(requirements, {
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredient.name,
      quantity: recipe.quantity * input.quantity,
      unit: recipe.ingredient.unit,
    });
  }
  for (const orderAdditional of configuration.additionals) {
    for (const recipe of orderAdditional.additional.ingredients) {
      addRequirement(requirements, {
        ingredientId: recipe.ingredientId,
        ingredientName: recipe.ingredient.name,
        quantity:
          recipe.quantity * orderAdditional.quantityPerUnit * input.quantity,
        unit: recipe.ingredient.unit,
      });
    }
  }
  const operation = await transaction.inventoryOperation.create({
    data: {
      actorUserId: input.actorUserId,
      comandaId: input.comandaId,
      establishmentId: input.establishmentId,
      reason: input.reason,
      requestId: input.requestId,
      sourceId: input.configurationId,
      type: "CANCELLATION",
    },
    select: { id: true },
  });
  if (input.disposition === "LOSS") {
    return;
  }
  for (const requirement of [...requirements.values()].sort((a, b) =>
    a.ingredientId.localeCompare(b.ingredientId),
  )) {
    const stock = await transaction.inventoryStock.findFirstOrThrow({
      where: {
        establishmentId: input.establishmentId,
        ingredientId: requirement.ingredientId,
      },
    });
    const deficitReduced = Math.min(stock.deficitQuantity, requirement.quantity);
    const restoredQuantity = requirement.quantity - deficitReduced;
    const lot = restoredQuantity
      ? await transaction.inventoryLot.create({
          data: {
            actorUserId: input.actorUserId,
            currentQuantity: restoredQuantity,
            establishmentId: input.establishmentId,
            initialQuantity: restoredQuantity,
            origin: "REVERSAL",
            receivedAt: new Date(),
            stockId: stock.id,
          },
        })
      : null;
    const balanceBefore = stock.quantity;
    const movement = await transaction.inventoryMovement.create({
      data: {
        actorUserId: input.actorUserId,
        balanceAfter: balanceBefore + requirement.quantity,
        balanceBefore,
        establishmentId: input.establishmentId,
        operationId: operation.id,
        quantityDelta: requirement.quantity,
        reason: input.reason,
        stockId: stock.id,
        type: "REVERSAL",
      },
    });
    if (lot) {
      await transaction.inventoryMovementLot.create({
        data: {
          establishmentId: input.establishmentId,
          lotId: lot.id,
          movementId: movement.id,
          quantityDelta: restoredQuantity,
        },
      });
    }
    await transaction.inventoryStock.update({
      data: {
        deficitQuantity:
          deficitReduced > 0 ? { decrement: deficitReduced } : undefined,
        quantity: { increment: requirement.quantity },
      },
      where: { id: stock.id },
    });
  }
}

function addRequirement(
  requirements: Map<string, Requirement>,
  requirement: Requirement,
) {
  const current = requirements.get(requirement.ingredientId);
  requirements.set(requirement.ingredientId, {
    ...requirement,
    quantity: requirement.quantity + (current?.quantity ?? 0),
  });
}

function compareLotsForFefo(
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

async function lockStocks(
  transaction: Transaction,
  establishmentId: string,
  ingredientIds: string[],
) {
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM InventoryStock WHERE establishmentId = ${establishmentId} AND ingredientId IN (${Prisma.join(ingredientIds)}) ORDER BY ingredientId FOR UPDATE`,
  );
}

function deduplicateWarnings(warnings: InventoryWarning[]) {
  return warnings.filter(
    (warning, index) =>
      warnings.findIndex(
        (candidate) =>
          candidate.type === warning.type &&
          candidate.ingredientId === warning.ingredientId &&
          candidate.productId === warning.productId,
      ) === index,
  );
}
