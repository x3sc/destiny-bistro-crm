import {
  ComandaItemNotFoundError,
  ComandaItemQuantityError,
  ProductUnavailableError,
  type Comanda,
} from "./comanda-types.js";
import {
  findOpenComanda,
  getComandaOrThrow,
  recordItemEvent,
  syncOpenCreditOrderTotal,
  type Transaction,
} from "./comanda-persistence.js";

const maxItemQuantity = 99;

export async function addComandaItem(
  transaction: Transaction,
  comandaId: string,
  productId: string,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, comandaId);

  const product = await transaction.product.findUnique({
    select: {
      active: true,
      id: true,
      name: true,
      priceCents: true,
    },
    where: { id: productId },
  });

  if (!product?.active) {
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
      productId: product.id,
      productName: product.name,
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

  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    itemId: existingItem.id,
    newQuantity: existingItem.quantity + 1,
    previousQuantity: existingItem.quantity,
    productId: existingItem.productId,
    productName: existingItem.productName,
    type: "ITEM_QUANTITY_CHANGED",
    unitPriceCents: existingItem.unitPriceCents,
  });

  return getComandaAfterItemMutation(transaction, comandaId);
}

export async function changeComandaItemQuantity(
  transaction: Transaction,
  comandaId: string,
  itemId: string,
  delta: 1 | -1,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, comandaId);

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
  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    itemId,
    newQuantity: nextQuantity,
    previousQuantity: item.quantity,
    productId: item.productId,
    productName: item.productName,
    type: "ITEM_QUANTITY_CHANGED",
    unitPriceCents: item.unitPriceCents,
  });

  return getComandaAfterItemMutation(transaction, comandaId);
}

export async function confirmComandaItem(
  transaction: Transaction,
  comandaId: string,
  itemId: string,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, comandaId);

  const item = await transaction.comandaItem.findFirst({
    select: {
      confirmedQuantity: true,
      id: true,
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

  if (item.confirmedQuantity >= item.quantity) {
    throw new ComandaItemQuantityError();
  }

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
    itemId,
    newQuantity: item.quantity,
    previousQuantity: item.confirmedQuantity,
    productId: item.productId,
    productName: item.productName,
    type: "ITEM_CONFIRMED",
    unitPriceCents: item.unitPriceCents,
  });

  return getComandaAfterItemMutation(transaction, comandaId);
}

export async function removeComandaItem(
  transaction: Transaction,
  comandaId: string,
  itemId: string,
  actorUserId: string,
): Promise<Comanda> {
  await findOpenComanda(transaction, comandaId);

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

    await recordItemEvent(transaction, {
      actorUserId,
      comandaId,
      itemId,
      newQuantity: item.confirmedQuantity,
      previousQuantity: item.quantity,
      productId: item.productId,
      productName: item.productName,
      type: "ITEM_QUANTITY_CHANGED",
      unitPriceCents: item.unitPriceCents,
    });

    return getComandaAfterItemMutation(transaction, comandaId);
  }

  await recordItemEvent(transaction, {
    actorUserId,
    comandaId,
    itemId,
    newQuantity: 0,
    previousQuantity: item.quantity,
    productId: item.productId,
    productName: item.productName,
    type: "ITEM_REMOVED",
    unitPriceCents: item.unitPriceCents,
  });

  await transaction.comandaItem.delete({
    where: { id: itemId },
  });

  return getComandaAfterItemMutation(transaction, comandaId);
}

async function createFirstComandaItem(
  transaction: Transaction,
  product: {
    actorUserId: string;
    comandaId: string;
    productId: string;
    productName: string;
    unitPriceCents: number;
  },
) {
  const item = await transaction.comandaItem.create({
    data: {
      comandaId: product.comandaId,
      productId: product.productId,
      productName: product.productName,
      quantity: 1,
      unitPriceCents: product.unitPriceCents,
    },
    select: {
      id: true,
    },
  });

  await recordItemEvent(transaction, {
    actorUserId: product.actorUserId,
    comandaId: product.comandaId,
    itemId: item.id,
    newQuantity: 1,
    previousQuantity: 0,
    productId: product.productId,
    productName: product.productName,
    type: "ITEM_ADDED",
    unitPriceCents: product.unitPriceCents,
  });

  return getComandaAfterItemMutation(transaction, product.comandaId);
}

async function getComandaAfterItemMutation(
  transaction: Transaction,
  comandaId: string,
) {
  await syncOpenCreditOrderTotal(transaction, comandaId);
  return getComandaOrThrow(transaction, comandaId);
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
