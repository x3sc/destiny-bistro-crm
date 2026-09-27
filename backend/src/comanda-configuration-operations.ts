import { createHash } from "node:crypto";
import {
  buildItemCancellationFingerprint,
  isMatchingCancellationReplay,
  normalizeCancellationReason,
} from "./cancellation-idempotency.js";
import { createAuditData } from "./audit.js";
import {
  AdditionalUnavailableError,
  ComandaCancellationConflictError,
  ComandaItemConfigurationError,
  ComandaItemNotFoundError,
  type Comanda,
  type ConfirmItemResult,
} from "./comanda-types.js";
import {
  findOpenComanda,
  getComandaOrThrow,
  syncOpenCreditOrderTotal,
  type Transaction,
} from "./comanda-persistence.js";
import { reverseConfigurationInventory } from "./inventory-consumption.js";

interface ConfigureAdditionalsInput {
  additionals: { additionalId: string; quantityPerUnit: number }[];
  quantity: number;
  requestId: string;
}

interface CancelConfigurationInput {
  disposition: "RETURN_TO_STOCK" | "LOSS";
  quantity: number;
  reason: string;
  requestId: string;
}

export async function configureComandaItemAdditionals(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  itemId: string,
  input: ConfigureAdditionalsInput,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, establishmentId, comandaId);
  validateConfigureInput(input);

  const replay = await transaction.inventoryOperation.findUnique({
    select: { id: true },
    where: {
      establishmentId_requestId: { establishmentId, requestId: input.requestId },
    },
  });
  if (replay) {
    return getComandaOrThrow(transaction, establishmentId, comandaId);
  }

  const item = await transaction.comandaItem.findFirst({
    include: {
      configurations: {
        include: { additionals: true },
        orderBy: { id: "asc" },
      },
    },
    where: { comandaId, establishmentId, id: itemId },
  });
  if (!item) {
    throw new ComandaItemNotFoundError();
  }
  if (item.quantity <= item.confirmedQuantity) {
    throw new ComandaItemConfigurationError();
  }

  const requestedIds = input.additionals.map(({ additionalId }) => additionalId);
  const allowed = requestedIds.length
    ? await transaction.productAdditional.findMany({
        include: { additional: true },
        where: {
          additional: { active: true },
          additionalId: { in: requestedIds },
          establishmentId,
          productId: item.productId,
        },
      })
    : [];
  if (allowed.length !== requestedIds.length) {
    throw new AdditionalUnavailableError();
  }

  const baseConfiguration = item.configurations.find(
    ({ configurationKey }) => configurationKey === "base",
  );
  const basePending = baseConfiguration
    ? baseConfiguration.quantity - baseConfiguration.confirmedQuantity
    : 0;
  if (!baseConfiguration || basePending < input.quantity) {
    throw new ComandaItemConfigurationError();
  }

  const normalizedAdditionals = input.additionals
    .map((requested) => ({
      ...requested,
      additional: allowed.find(
        ({ additionalId }) => additionalId === requested.additionalId,
      )!.additional,
    }))
    .sort((a, b) => a.additionalId.localeCompare(b.additionalId));
  const configurationKey = buildConfigurationKey(normalizedAdditionals);
  const additionalCentsPerUnit = normalizedAdditionals.reduce(
    (total, entry) =>
      total + entry.additional.priceCents * entry.quantityPerUnit,
    0,
  );

  await transaction.inventoryOperation.create({
    data: {
      actorUserId,
      comandaId,
      establishmentId,
      reason: "Personalização de item pendente",
      requestId: input.requestId,
      sourceId: itemId,
      type: "CONFIGURATION",
    },
  });
  await transaction.comandaItemConfiguration.update({
    data: { quantity: { decrement: input.quantity } },
    where: { id: baseConfiguration.id },
  });
  const existingTarget = await transaction.comandaItemConfiguration.findUnique({
    select: { id: true },
    where: {
      comandaItemId_configurationKey: { comandaItemId: itemId, configurationKey },
    },
  });
  const target = existingTarget
    ? await transaction.comandaItemConfiguration.update({
        data: { quantity: { increment: input.quantity } },
        where: { id: existingTarget.id },
      })
    : await transaction.comandaItemConfiguration.create({
        data: {
          comandaItemId: itemId,
          configurationKey,
          establishmentId,
          quantity: input.quantity,
        },
      });
  if (!existingTarget) {
    await transaction.comandaItemAdditional.createMany({
      data: normalizedAdditionals.map((entry) => ({
        additionalId: entry.additionalId,
        additionalName: entry.additional.name,
        configurationId: target.id,
        establishmentId,
        quantityPerUnit: entry.quantityPerUnit,
        unitPriceCents: entry.additional.priceCents,
      })),
    });
  }
  await transaction.comandaItem.update({
    data: {
      additionalTotalCents: {
        increment: additionalCentsPerUnit * input.quantity,
      },
    },
    where: { id: itemId },
  });
  await transaction.comandaEvent.create({
    data: {
      actorUserId,
      comandaId,
      establishmentId,
      itemId,
      newQuantity: input.quantity,
      productId: item.productId,
      productName: item.productName,
      type: "ADDITIONALS_CHANGED",
      unitPriceCents: item.unitPriceCents,
    },
  });
  await transaction.auditLog.create({
    data: createAuditData({
      action: "COMANDA_ADDITIONALS_CHANGED",
      establishmentId,
      metadata: {
        additionals: normalizedAdditionals.map((entry) => ({
          additionalId: entry.additionalId,
          quantityPerUnit: entry.quantityPerUnit,
        })),
        comandaId,
        quantity: input.quantity,
        requestId: input.requestId,
      },
      resourceId: target.id,
      resourceType: "COMANDA_ITEM_CONFIGURATION",
      userId: actorUserId,
    }),
  });

  await syncOpenCreditOrderTotal(transaction, establishmentId, comandaId);
  return getComandaOrThrow(transaction, establishmentId, comandaId);
}

export async function cancelComandaItemConfiguration(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  itemId: string,
  configurationId: string,
  input: CancelConfigurationInput,
  actorUserId: string,
): Promise<ConfirmItemResult> {
  input = { ...input, reason: normalizeCancellationReason(input.reason) };

  const requestFingerprint = buildItemCancellationFingerprint({
    actorUserId,
    comandaId,
    configurationId,
    disposition: input.disposition,
    itemId,
    quantity: input.quantity,
    reason: input.reason,
  });
  validateCancellationInput(input);

  const replay = await transaction.inventoryOperation.findUnique({
    where: {
      establishmentId_requestId: { establishmentId, requestId: input.requestId },
    },
  });
  if (replay) {
    if (
      !isMatchingCancellationReplay(replay, {
        comandaId,
        fingerprint: requestFingerprint,
        reason: input.reason,
        sourceId: configurationId,
      })
    ) {
      throw new ComandaCancellationConflictError();
    }
    return {
      comanda: await getComandaOrThrow(transaction, establishmentId, comandaId),
      inventoryWarnings: [],
    };
  }

  await findOpenComanda(transaction, establishmentId, comandaId);

  const configuration = await transaction.comandaItemConfiguration.findFirst({
    include: { additionals: true, comandaItem: true },
    where: { comandaItemId: itemId, establishmentId, id: configurationId },
  });
  if (
    !configuration ||
    configuration.comandaItem.comandaId !== comandaId ||
    configuration.confirmedQuantity < input.quantity
  ) {
    throw new ComandaItemConfigurationError();
  }

  await reverseConfigurationInventory(transaction, {
    actorUserId,
    comandaId,
    configurationId,
    disposition: input.disposition,
    establishmentId,
    itemId,
    productName: configuration.comandaItem.productName,
    quantity: input.quantity,
    reason: input.reason,
    requestId: input.requestId,
    requestFingerprint,
  });
  await transaction.comandaItemCancellation.create({
    data: {
      actorUserId,
      configurationId,
      disposition: input.disposition,
      establishmentId,
      quantity: input.quantity,
      reason: input.reason,
    },
  });
  const updatedConfiguration = await transaction.comandaItemConfiguration.updateMany({
    data: {
      confirmedQuantity: { decrement: input.quantity },
      quantity: { decrement: input.quantity },
    },
    where: {
      confirmedQuantity: { gte: input.quantity },
      id: configurationId,
      quantity: { gte: input.quantity },
    },
  });
  if (updatedConfiguration.count !== 1) {
    throw new ComandaItemConfigurationError();
  }
  const cancelledAdditionalCents = configuration.additionals.reduce(
    (total, additional) =>
      total + additional.unitPriceCents * additional.quantityPerUnit,
    0,
  ) * input.quantity;
  const updatedItem = await transaction.comandaItem.updateMany({
    data: {
      additionalTotalCents: { decrement: cancelledAdditionalCents },
      confirmedQuantity: { decrement: input.quantity },
      quantity: { decrement: input.quantity },
    },
    where: {
      confirmedQuantity: { gte: input.quantity },
      id: itemId,
      quantity: { gte: input.quantity },
    },
  });
  if (updatedItem.count !== 1) {
    throw new ComandaItemConfigurationError();
  }
  await transaction.comandaEvent.create({
    data: {
      actorUserId,
      comandaId,
      establishmentId,
      itemId,
      newQuantity: configuration.comandaItem.quantity - input.quantity,
      previousQuantity: configuration.comandaItem.quantity,
      productId: configuration.comandaItem.productId,
      productName: configuration.comandaItem.productName,
      type: "ITEM_CANCELLED",
      unitPriceCents: configuration.comandaItem.unitPriceCents,
    },
  });
  await transaction.auditLog.create({
    data: createAuditData({
      action: "COMANDA_ITEM_CANCELLED",
      establishmentId,
      metadata: {
        comandaId,
        disposition: input.disposition,
        quantity: input.quantity,
        reason: input.reason,
        requestId: input.requestId,
      },
      resourceId: configurationId,
      resourceType: "COMANDA_ITEM_CONFIGURATION",
      userId: actorUserId,
    }),
  });

  await syncOpenCreditOrderTotal(transaction, establishmentId, comandaId);
  return {
    comanda: await getComandaOrThrow(transaction, establishmentId, comandaId),
    inventoryWarnings: [],
  };
}

function buildConfigurationKey(
  additionals: { additionalId: string; quantityPerUnit: number }[],
) {
  if (additionals.length === 0) {
    return "base";
  }
  const serialized = additionals
    .map(({ additionalId, quantityPerUnit }) => `${additionalId}:${quantityPerUnit}`)
    .join("|");
  return `additional:${createHash("sha256").update(serialized).digest("hex")}`;
}

function validateConfigureInput(input: ConfigureAdditionalsInput) {
  const ids = new Set<string>();
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0 ||
    !isRequestId(input.requestId) ||
    input.additionals.length === 0
  ) {
    throw new ComandaItemConfigurationError();
  }
  for (const additional of input.additionals) {
    if (
      !additional.additionalId ||
      ids.has(additional.additionalId) ||
      !Number.isInteger(additional.quantityPerUnit) ||
      additional.quantityPerUnit <= 0
    ) {
      throw new ComandaItemConfigurationError();
    }
    ids.add(additional.additionalId);
  }
}

function validateCancellationInput(input: CancelConfigurationInput) {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0 ||
    !input.reason.trim() ||
    input.reason.trim().length > 255 ||
    !isRequestId(input.requestId) ||
    (input.disposition !== "RETURN_TO_STOCK" && input.disposition !== "LOSS")
  ) {
    throw new ComandaItemConfigurationError();
  }
}

function isRequestId(value: string) {
  return value.length >= 8 && value.length <= 191;
}
