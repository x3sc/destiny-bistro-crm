import { createHash } from "node:crypto";
import { type Prisma } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  ComandaBatchConfirmationConflictError,
  type ConfirmItemsBatchInput,
  type ConfirmItemsBatchResult,
  type InventoryWarning,
} from "./comanda-types.js";
import {
  findOpenComanda,
  type Transaction,
} from "./comanda-persistence.js";
import { confirmComandaItem } from "./comanda-item-operations.js";

export function buildBatchConfirmationFingerprint(
  comandaId: string,
  actorUserId: string,
  input: ConfirmItemsBatchInput,
) {
  const items = [...input.items].sort((left, right) =>
    left.itemId.localeCompare(right.itemId),
  );
  return createHash("sha256")
    .update(JSON.stringify({ actorUserId, comandaId, items }))
    .digest("hex");
}

export async function confirmComandaItemsBatch(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  input: ConfirmItemsBatchInput,
  actorUserId: string,
  requestFingerprint: string,
): Promise<ConfirmItemsBatchResult> {
  await findOpenComanda(transaction, establishmentId, comandaId);
  const currentItems = await transaction.comandaItem.findMany({
    orderBy: { id: "asc" },
    select: {
      confirmedQuantity: true,
      id: true,
      quantity: true,
    },
    where: { comandaId, establishmentId },
  });
  const pendingItems = currentItems.filter(
    ({ confirmedQuantity, quantity }) => confirmedQuantity < quantity,
  );
  const expectedById = new Map(input.items.map((item) => [item.itemId, item]));
  const matches =
    expectedById.size === input.items.length &&
    pendingItems.length === input.items.length &&
    pendingItems.every((item) => {
      const expected = expectedById.get(item.id);
      return (
        expected?.expectedConfirmedQuantity === item.confirmedQuantity &&
        expected.expectedQuantity === item.quantity
      );
    });
  if (!matches) {
    throw new ComandaBatchConfirmationConflictError();
  }

  const batch = await transaction.comandaConfirmationBatch.create({
    data: {
      actorUserId,
      comandaId,
      establishmentId,
      inventoryWarnings: [],
      requestFingerprint,
      requestId: input.requestId,
    },
    select: { id: true },
  });
  let result: ConfirmItemsBatchResult | null = null;
  const warnings: InventoryWarning[] = [];
  for (const item of [...input.items].sort((left, right) =>
    left.itemId.localeCompare(right.itemId),
  )) {
    const confirmed = await confirmComandaItem(
      transaction,
      establishmentId,
      comandaId,
      item.itemId,
      actorUserId,
    );
    warnings.push(...confirmed.inventoryWarnings);
    result = { ...confirmed, inventoryWarnings: warnings, replayed: false };
  }
  if (!result) {
    throw new ComandaBatchConfirmationConflictError();
  }

  const inventoryWarnings = deduplicateWarnings(warnings);
  await transaction.comandaConfirmationBatch.update({
    data: {
      inventoryWarnings:
        inventoryWarnings as unknown as Prisma.InputJsonValue,
    },
    where: { id: batch.id },
  });
  await transaction.auditLog.create({
    data: createAuditData({
      action: "COMANDA_ITEMS_CONFIRMED_BATCH",
      establishmentId,
      metadata: {
        itemCount: input.items.length,
        requestId: input.requestId,
      },
      resourceId: comandaId,
      resourceType: "COMANDA",
      userId: actorUserId,
    }),
  });

  return { ...result, inventoryWarnings };
}

function deduplicateWarnings(warnings: InventoryWarning[]) {
  const unique = new Map(
    warnings.map((warning) => [JSON.stringify(warning), warning]),
  );
  return [...unique.values()];
}
