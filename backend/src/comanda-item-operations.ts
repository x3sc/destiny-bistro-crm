import {
  ComandaItemNotFoundError,
  ComandaItemQuantityError,
  ProductUnavailableError,
  type Comanda,
  type ConfirmItemResult,
} from "./comanda-types.js";
import {
  findOpenComanda,
  getComandaOrThrow,
  recordItemEvent,
  syncOpenCreditOrderTotal,
  type Transaction,
} from "./comanda-persistence.js";
import { consumePendingItemInventory } from "./inventory-consumption.js";
import {
  createKitchenTicketForConfirmation,
  type PendingKitchenConfiguration,
} from "./kitchen-ticket-operations.js";

const maxItemQuantity = 99;

export async function addComandaItem(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  productId: string,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, establishmentId, comandaId);

  const product = await transaction.product.findFirst({
    select: {
      id: true,
      name: true,
      priceCents: true,
      requiresKitchen: true,
    },
    where: {
      active: true,
      category: { active: true },
      establishmentId,
      id: productId,
    },
  });

  if (!product) {
    throw new ProductUnavailableError();
  }

  const existingItem = await transaction.comandaItem.findUnique({
    select: {
      confirmedQuantity: true,
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
    },
    where: {
      comandaId_productId: {
        comandaId,
        productId,
      },
    },
  });

  if (!existingItem) {
    return createFirstComandaItem(transaction, {
      actorUserId,
      comandaId,
      establishmentId,
      productId: product.id,
      productName: product.name,
      requiresKitchen: product.requiresKitchen,
      unitPriceCents: product.priceCents,
    });
  }

  if (existingItem.quantity >= maxItemQuantity) {
    throw new ComandaItemQuantityError();
  }

  const updated = await transaction.comandaItem.updateMany({
    data: {
      quantity: {
        increment: 1,
      },
    },
    where: {
      confirmedQuantity: existingItem.confirmedQuantity,
      id: existingItem.id,
      quantity: {
        lt: maxItemQuantity,
      },
    },
  });

  if (updated.count !== 1) {
    throw new ComandaItemQuantityError();
  }

  await incrementBaseConfiguration(
    transaction,
    establishmentId,
    existingItem.id,
  );

  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    establishmentId,
    itemId: existingItem.id,
    newQuantity: existingItem.quantity + 1,
    previousQuantity: existingItem.quantity,
    productId: existingItem.productId,
    productName: existingItem.productName,
    type: "ITEM_QUANTITY_CHANGED",
    unitPriceCents: existingItem.unitPriceCents,
  });

  return getComandaAfterItemMutation(transaction, establishmentId, comandaId);
}

export async function changeComandaItemQuantity(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  itemId: string,
  delta: 1 | -1,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, establishmentId, comandaId);

  const item = await transaction.comandaItem.findFirst({
    select: {
      confirmedQuantity: true,
      id: true,
      product: {
        select: {
          active: true,
        },
      },
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
    },
    where: {
      comandaId,
      id: itemId,
    },
  });

  if (!item) {
    throw new ComandaItemNotFoundError();
  }

  if (delta === 1 && !item.product.active) {
    throw new ProductUnavailableError();
  }

  const nextQuantity = item.quantity + delta;
  const minimumQuantity = Math.max(1, item.confirmedQuantity);

  if (nextQuantity < minimumQuantity || nextQuantity > maxItemQuantity) {
    throw new ComandaItemQuantityError();
  }

  await updateComandaItemQuantity(transaction, {
    comandaId,
    confirmedQuantity: item.confirmedQuantity,
    delta,
    itemId,
  });
  await changePendingConfigurationQuantity(
    transaction,
    establishmentId,
    itemId,
    delta,
  );
  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    establishmentId,
    itemId,
    newQuantity: nextQuantity,
    previousQuantity: item.quantity,
    productId: item.productId,
    productName: item.productName,
    type: "ITEM_QUANTITY_CHANGED",
    unitPriceCents: item.unitPriceCents,
  });

  return getComandaAfterItemMutation(transaction, establishmentId, comandaId);
}

export async function confirmComandaItem(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  itemId: string,
  actorUserId: string,
): Promise<ConfirmItemResult> {
  await findOpenComanda(transaction, establishmentId, comandaId);

  const item = await transaction.comandaItem.findFirst({
    select: {
      confirmedQuantity: true,
      configurations: {
        orderBy: { id: "asc" },
        select: {
          additionals: {
            orderBy: { additionalName: "asc" },
            select: {
              additionalId: true,
              additionalName: true,
              quantityPerUnit: true,
            },
          },
          configurationKey: true,
          confirmedQuantity: true,
          id: true,
          quantity: true,
        },
      },
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      requiresKitchen: true,
      unitPriceCents: true,
    },
    where: {
      comandaId,
      id: itemId,
    },
  });

  if (!item) {
    throw new ComandaItemNotFoundError();
  }

  if (item.confirmedQuantity >= item.quantity) {
    return {
      comanda: await getComandaAfterItemMutation(
        transaction,
        establishmentId,
        comandaId,
      ),
      inventoryWarnings: [],
    };
  }

  const quantityToKitchen = item.quantity - item.confirmedQuantity;
  const kitchenConfigurations: PendingKitchenConfiguration[] =
    item.configurations
      .map((configuration) => ({
        additionals: configuration.additionals,
        configurationKey: configuration.configurationKey,
        quantity: configuration.quantity - configuration.confirmedQuantity,
        sourceConfigurationId: configuration.id,
      }))
      .filter((configuration) => configuration.quantity > 0);
  if (
    kitchenConfigurations.reduce(
      (total, configuration) => total + configuration.quantity,
      0,
    ) !== quantityToKitchen
  ) {
    throw new ComandaItemQuantityError();
  }

  const inventoryWarnings = await consumePendingItemInventory(transaction, {
    actorUserId,
    comandaId,
    establishmentId,
    itemId,
    newConfirmedQuantity: item.quantity,
    previousConfirmedQuantity: item.confirmedQuantity,
    productId: item.productId,
    productName: item.productName,
  });

  const confirmed = await transaction.comandaItem.updateMany({
    data: {
      confirmedQuantity: item.quantity,
    },
    where: {
      comandaId,
      confirmedQuantity: item.confirmedQuantity,
      id: itemId,
      quantity: item.quantity,
    },
  });

  if (confirmed.count !== 1) {
    throw new ComandaItemQuantityError();
  }

  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    establishmentId,
    itemId,
    newQuantity: item.quantity,
    previousQuantity: item.confirmedQuantity,
    productId: item.productId,
    productName: item.productName,
    type: "ITEM_CONFIRMED",
    unitPriceCents: item.unitPriceCents,
  });

  if (item.requiresKitchen) {
    await createKitchenTicketForConfirmation(transaction, {
      actorUserId,
      comandaId,
      comandaItemId: item.id,
      confirmationKey: `CONFIRM:${item.id}:${item.confirmedQuantity}:${item.quantity}`,
      configurations: kitchenConfigurations,
      establishmentId,
      productId: item.productId,
      productName: item.productName,
      quantity: quantityToKitchen,
    });
  }

  return {
    comanda: await getComandaAfterItemMutation(
      transaction,
      establishmentId,
      comandaId,
    ),
    inventoryWarnings,
  };
}

export async function removeComandaItem(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
  itemId: string,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, establishmentId, comandaId);

  const item = await transaction.comandaItem.findUnique({
    select: {
      comandaId: true,
      confirmedQuantity: true,
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPriceCents: true,
    },
    where: { id: itemId },
  });

  if (!item || item.comandaId !== comandaId) {
    throw new ComandaItemNotFoundError();
  }

  if (item.quantity <= item.confirmedQuantity) {
    throw new ComandaItemQuantityError();
  }

  if (item.confirmedQuantity > 0) {
    const updated = await transaction.comandaItem.updateMany({
      data: {
        quantity: item.confirmedQuantity,
      },
      where: {
        comandaId,
        confirmedQuantity: item.confirmedQuantity,
        id: itemId,
        quantity: item.quantity,
      },
    });

    if (updated.count !== 1) {
      throw new ComandaItemQuantityError();
    }

    await removePendingConfigurationQuantities(
      transaction,
      establishmentId,
      itemId,
    );

    await recordItemEvent(transaction, {
      actorUserId,
      comandaId,
      establishmentId,
      itemId,
      newQuantity: item.confirmedQuantity,
      previousQuantity: item.quantity,
      productId: item.productId,
      productName: item.productName,
      type: "ITEM_QUANTITY_CHANGED",
      unitPriceCents: item.unitPriceCents,
    });

    return getComandaAfterItemMutation(transaction, establishmentId, comandaId);
  }

  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    establishmentId,
    itemId,
    newQuantity: 0,
    previousQuantity: item.quantity,
    productId: item.productId,
    productName: item.productName,
    type: "ITEM_REMOVED",
    unitPriceCents: item.unitPriceCents,
  });

  const configurationIds = await transaction.comandaItemConfiguration.findMany({
    select: { id: true },
    where: { comandaItemId: itemId, establishmentId },
  });
  if (configurationIds.length > 0) {
    await transaction.comandaItemAdditional.deleteMany({
      where: {
        configurationId: { in: configurationIds.map(({ id }) => id) },
        establishmentId,
      },
    });
    await transaction.comandaItemConfiguration.deleteMany({
      where: { comandaItemId: itemId, establishmentId },
    });
  }
  await transaction.comandaItem.delete({
    where: { id: itemId },
  });

  return getComandaAfterItemMutation(transaction, establishmentId, comandaId);
}

async function createFirstComandaItem(
  transaction: Transaction,
  product: {
    actorUserId: string;
    comandaId: string;
    establishmentId: string;
    productId: string;
    productName: string;
    requiresKitchen: boolean;
    unitPriceCents: number;
  },
) {
  const item = await transaction.comandaItem.create({
    data: {
      comandaId: product.comandaId,
      establishmentId: product.establishmentId,
      productId: product.productId,
      productName: product.productName,
      quantity: 1,
      requiresKitchen: product.requiresKitchen,
      unitPriceCents: product.unitPriceCents,
    },
    select: {
      id: true,
    },
  });

  await transaction.comandaItemConfiguration.create({
    data: {
      comandaItemId: item.id,
      configurationKey: "base",
      establishmentId: product.establishmentId,
      quantity: 1,
    },
  });

  await recordItemEvent(transaction, {
    actorUserId: product.actorUserId,
    comandaId: product.comandaId,
    establishmentId: product.establishmentId,
    itemId: item.id,
    newQuantity: 1,
    previousQuantity: 0,
    productId: product.productId,
    productName: product.productName,
    type: "ITEM_ADDED",
    unitPriceCents: product.unitPriceCents,
  });

  return getComandaAfterItemMutation(
    transaction,
    product.establishmentId,
    product.comandaId,
  );
}

async function incrementBaseConfiguration(
  transaction: Transaction,
  establishmentId: string,
  itemId: string,
) {
  await transaction.comandaItemConfiguration.upsert({
    create: {
      comandaItemId: itemId,
      configurationKey: "base",
      establishmentId,
      quantity: 1,
    },
    update: { quantity: { increment: 1 } },
    where: {
      comandaItemId_configurationKey: {
        comandaItemId: itemId,
        configurationKey: "base",
      },
    },
  });

}

async function changePendingConfigurationQuantity(
  transaction: Transaction,
  establishmentId: string,
  itemId: string,
  delta: 1 | -1,
) {
  if (delta === 1) {
    await incrementBaseConfiguration(transaction, establishmentId, itemId);
    return;
  }

  const configurations = await transaction.comandaItemConfiguration.findMany({
    orderBy: [{ configurationKey: "asc" }, { id: "asc" }],
    select: { confirmedQuantity: true, id: true, quantity: true },
    where: { comandaItemId: itemId, establishmentId },
  });
  const pending = configurations.find(
    (configuration) => configuration.quantity > configuration.confirmedQuantity,
  );
  if (!pending) {
    throw new ComandaItemQuantityError();
  }
  await transaction.comandaItemConfiguration.update({
    data: { quantity: { decrement: 1 } },
    where: { id: pending.id },
  });
}

async function removePendingConfigurationQuantities(
  transaction: Transaction,
  establishmentId: string,
  itemId: string,
) {
  const configurations = await transaction.comandaItemConfiguration.findMany({
    select: { confirmedQuantity: true, id: true },
    where: { comandaItemId: itemId, establishmentId },
  });
  for (const configuration of configurations) {
    await transaction.comandaItemConfiguration.update({
      data: { quantity: configuration.confirmedQuantity },
      where: { id: configuration.id },
    });
  }
}

async function getComandaAfterItemMutation(
  transaction: Transaction,
  establishmentId: string,
  comandaId: string,
) {
  await syncOpenCreditOrderTotal(transaction, establishmentId, comandaId);
  return getComandaOrThrow(transaction, establishmentId, comandaId);
}

async function updateComandaItemQuantity(
  transaction: Transaction,
  {
    comandaId,
    confirmedQuantity,
    delta,
    itemId,
  }: {
    comandaId: string;
    confirmedQuantity: number;
    delta: 1 | -1;
    itemId: string;
  },
) {
  const updated = await transaction.comandaItem.updateMany({
    data: {
      quantity: {
        increment: delta,
      },
    },
    where: {
      comandaId,
      confirmedQuantity,
      id: itemId,
      quantity:
        delta === 1
          ? {
              lt: maxItemQuantity,
            }
          : {
              gt: Math.max(1, confirmedQuantity),
            },
    },
  });

  if (updated.count !== 1) {
    throw new ComandaItemQuantityError();
  }
}
