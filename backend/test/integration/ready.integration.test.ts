import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildApp } from "../../src/app.js";
import { createPersistence, createPrismaClient } from "../../src/database.js";
import {
  LEGACY_SEED_PRODUCT_CODES,
  PORTUGAS_MENU,
} from "../../src/product-catalog.js";

const prisma = createPrismaClient();

before(async () => {
  await prisma.restaurantTable.updateMany({
    data: {
      activeComandaId: null,
      status: "FREE",
    },
  });
  await prisma.comandaItem.deleteMany();
  await prisma.comandaEvent.deleteMany();
  await prisma.comanda.deleteMany();
});

after(async () => {
  await prisma.restaurantTable.updateMany({
    data: {
      activeComandaId: null,
      status: "FREE",
    },
  });
  await prisma.comandaItem.deleteMany();
  await prisma.comandaEvent.deleteMany();
  await prisma.comanda.deleteMany();
  await prisma.$disconnect();
});

void test("GET /ready connects to the configured MySQL database", async () => {
  const { comandas, database, products, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
    products,
    restaurantTables,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      status: "ok",
      database: "connected",
    });
  } finally {
    await app.close();
  }
});

void test("comanda lifecycle is persisted and audited", async () => {
  const table = await prisma.restaurantTable.findUniqueOrThrow({
    where: { number: 1 },
  });
  const { comandas, database, products, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
    products,
    restaurantTables,
  });

  try {
    const openResponse = await app.inject({
      method: "POST",
      payload: {
        name: "  João  ",
      },
      url: `/tables/${table.id}/comandas`,
    });
    const openedComanda = openResponse.json<{
      comanda: {
        id: string;
        name: string | null;
        number: number;
      };
    }>().comanda;

    assert.equal(openResponse.statusCode, 201);
    assert.ok(openedComanda.number > 0);
    assert.equal(openedComanda.name, "João");

    const persistedOpenTable = await prisma.restaurantTable.findUniqueOrThrow({
      where: { id: table.id },
    });
    assert.equal(persistedOpenTable.status, "OPEN");
    assert.equal(persistedOpenTable.activeComandaId, openedComanda.id);
    assert.equal(
      await prisma.comanda.findUniqueOrThrow({
        select: { name: true },
        where: { id: openedComanda.id },
      }).then(({ name }) => name),
      "João",
    );

    const openedEvent = await prisma.comandaEvent.findFirstOrThrow({
      where: {
        comandaId: openedComanda.id,
        type: "OPENED",
      },
    });
    assert.equal(openedEvent.reason, null);

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/tables/${table.id}/comandas`,
    });
    assert.equal(duplicateResponse.statusCode, 409);

    const tablesResponse = await app.inject({
      method: "GET",
      url: "/tables",
    });
    const openTable = tablesResponse
      .json<{
        tables: {
          activeComanda: { id: string; name: string | null; number: number } | null;
          id: number;
          status: string;
        }[];
      }>()
      .tables.find(({ id }) => id === table.id);
    assert.deepEqual(openTable, {
      activeComanda: {
        id: openedComanda.id,
        name: "João",
        number: openedComanda.number,
      },
      id: table.id,
      number: 1,
      status: "OPEN",
    });

    const detailsResponse = await app.inject({
      method: "GET",
      url: `/comandas/${openedComanda.id}`,
    });
    assert.equal(detailsResponse.statusCode, 200);

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/cancel`,
    });
    assert.equal(cancelResponse.statusCode, 200);

    const persistedFreeTable = await prisma.restaurantTable.findUniqueOrThrow({
      where: { id: table.id },
    });
    assert.equal(persistedFreeTable.status, "FREE");
    assert.equal(persistedFreeTable.activeComandaId, null);

    const cancelledEvent = await prisma.comandaEvent.findFirstOrThrow({
      where: {
        comandaId: openedComanda.id,
        type: "CANCELLED",
      },
    });
    assert.equal(cancelledEvent.reason, "OPENED_BY_MISTAKE");

    const secondCancelResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/cancel`,
    });
    assert.equal(secondCancelResponse.statusCode, 409);
  } finally {
    await app.close();
  }
});

void test("concurrent comanda opening allows only one active comanda per table", async () => {
  const table = await prisma.restaurantTable.findUniqueOrThrow({
    where: { number: 2 },
  });
  const { comandas, database, products, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
    products,
    restaurantTables,
  });

  try {
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/tables/${table.id}/comandas`,
      }),
      app.inject({
        method: "POST",
        url: `/tables/${table.id}/comandas`,
      }),
    ]);
    const statusCodes = responses.map(({ statusCode }) => statusCode).sort();

    assert.deepEqual(statusCodes, [201, 409]);

    const openedResponse = responses.find(({ statusCode }) => statusCode === 201);
    assert.ok(openedResponse);

    const openedComanda = openedResponse.json<{
      comanda: {
        id: string;
      };
    }>().comanda;
    const activeComandas = await prisma.comanda.count({
      where: {
        activeForTable: {
          id: table.id,
        },
        status: "OPEN",
      },
    });
    assert.equal(activeComandas, 1);

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/cancel`,
    });
    assert.equal(cancelResponse.statusCode, 200);
  } finally {
    await app.close();
  }
});

void test("product seed is idempotent and listed as active catalog", async () => {
  const seededCodes = PORTUGAS_MENU.map(({ code }) => code);
  const activeMenu = PORTUGAS_MENU.filter(({ active }) => active);

  const productsByCode = await prisma.product.groupBy({
    by: ["code"],
    _count: {
      code: true,
    },
    where: {
      code: {
        in: seededCodes,
      },
    },
  });

  assert.equal(productsByCode.length, seededCodes.length);
  assert.equal(productsByCode.every(({ _count }) => _count.code === 1), true);
  assert.equal(
    await prisma.product.count({
      where: {
        active: true,
        code: {
          in: [...LEGACY_SEED_PRODUCT_CODES],
        },
      },
    }),
    0,
  );

  const { comandas, database, products, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
    products,
    restaurantTables,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/products",
    });

    assert.equal(response.statusCode, 200);
    const catalog = response.json<{
      products: {
        category: string;
        id: string;
        name: string;
        priceCents: number;
      }[];
    }>().products;
    const catalogByName = new Map(catalog.map((product) => [product.name, product]));

    assert.equal(catalog.length, activeMenu.length);
    assert.equal(catalogByName.size, activeMenu.length);

    for (const product of activeMenu) {
      assert.equal(catalogByName.get(product.name)?.category, product.category);
      assert.equal(catalogByName.get(product.name)?.priceCents, product.priceCents);
    }

    assert.equal(catalog.some(({ category }) => category === "EXTRAS"), false);
  } finally {
    await app.close();
  }
});

void test("comanda items are consolidated, totaled and audited", async () => {
  const table = await prisma.restaurantTable.findUniqueOrThrow({
    where: { number: 3 },
  });
  const hamburger = await prisma.product.findUniqueOrThrow({
    where: { code: "CLASSIC_HAMBURGER" },
  });
  const { comandas, database, products, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
    products,
    restaurantTables,
  });

  try {
    const openResponse = await app.inject({
      method: "POST",
      url: `/tables/${table.id}/comandas`,
    });
    const openedComanda = openResponse.json<{
      comanda: {
        id: string;
      };
    }>().comanda;

    const addResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${openedComanda.id}/items`,
    });
    assert.equal(addResponse.statusCode, 200);
    const firstItem = addResponse.json<{
      comanda: {
        items: {
          confirmedQuantity: number;
          id: string;
          productId: string;
          productName: string;
          quantity: number;
          subtotalCents: number;
          unitPriceCents: number;
        }[];
        totalCents: number;
      };
    }>().comanda.items[0];
    assert.deepEqual(firstItem, {
      confirmedQuantity: 0,
      id: firstItem.id,
      productId: hamburger.id,
      productName: "Hambúrguer",
      quantity: 1,
      subtotalCents: 1_099,
      unitPriceCents: 1_099,
    });

    const closeWithPendingItemResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/close`,
    });
    assert.equal(closeWithPendingItemResponse.statusCode, 409);

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/items/${firstItem.id}/confirm`,
    });
    assert.equal(confirmResponse.statusCode, 200);
    assert.equal(
      confirmResponse.json<{
        comanda: { items: { confirmedQuantity: number; quantity: number }[] };
      }>().comanda.items[0].confirmedQuantity,
      1,
    );

    const cancelWithItemResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/cancel`,
    });
    assert.equal(cancelWithItemResponse.statusCode, 409);

    const invalidDecrementResponse = await app.inject({
      method: "PATCH",
      payload: {
        delta: -1,
      },
      url: `/comandas/${openedComanda.id}/items/${firstItem.id}`,
    });
    assert.equal(invalidDecrementResponse.statusCode, 409);

    const secondAddResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${openedComanda.id}/items`,
    });
    const consolidated = secondAddResponse.json<{
      comanda: {
        items: {
          confirmedQuantity: number;
          id: string;
          quantity: number;
          subtotalCents: number;
        }[];
        totalCents: number;
      };
    }>().comanda;
    assert.equal(secondAddResponse.statusCode, 200);
    assert.equal(consolidated.items.length, 1);
    assert.equal(consolidated.items[0].confirmedQuantity, 1);
    assert.equal(consolidated.items[0].quantity, 2);
    assert.equal(consolidated.items[0].subtotalCents, 2_198);
    assert.equal(consolidated.totalCents, 2_198);

    const decrementNewItemResponse = await app.inject({
      method: "PATCH",
      payload: {
        delta: -1,
      },
      url: `/comandas/${openedComanda.id}/items/${firstItem.id}`,
    });
    assert.equal(decrementNewItemResponse.statusCode, 200);
    assert.equal(
      decrementNewItemResponse.json<{
        comanda: {
          items: { confirmedQuantity: number; quantity: number }[];
        };
      }>().comanda.items[0].quantity,
      1,
    );

    const addNewItemAgainResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${openedComanda.id}/items`,
    });
    assert.equal(addNewItemAgainResponse.statusCode, 200);

    const removeResponse = await app.inject({
      method: "DELETE",
      url: `/comandas/${openedComanda.id}/items/${firstItem.id}`,
    });
    assert.equal(removeResponse.statusCode, 200);
    assert.deepEqual(
      removeResponse.json<{
        comanda: {
          items: { confirmedQuantity: number; quantity: number }[];
          totalCents: number;
        };
      }>().comanda.items.map(({ confirmedQuantity, quantity }) => ({
        confirmedQuantity,
        quantity,
      })),
      [{ confirmedQuantity: 1, quantity: 1 }],
    );
    assert.equal(
      removeResponse.json<{ comanda: { totalCents: number } }>().comanda.totalCents,
      1_099,
    );

    const removeConfirmedItemResponse = await app.inject({
      method: "DELETE",
      url: `/comandas/${openedComanda.id}/items/${firstItem.id}`,
    });
    assert.equal(removeConfirmedItemResponse.statusCode, 409);

    const events = await prisma.comandaEvent.findMany({
      orderBy: {
        createdAt: "asc",
      },
      where: {
        comandaId: openedComanda.id,
      },
    });
    assert.deepEqual(
      events.map(({ type }) => type),
      [
        "OPENED",
        "ITEM_ADDED",
        "ITEM_CONFIRMED",
        "ITEM_QUANTITY_CHANGED",
        "ITEM_QUANTITY_CHANGED",
        "ITEM_QUANTITY_CHANGED",
        "ITEM_QUANTITY_CHANGED",
      ],
    );
    assert.equal(events[1].previousQuantity, 0);
    assert.equal(events[1].newQuantity, 1);
    assert.equal(events[1].productName, "Hambúrguer");
    assert.equal(events[1].unitPriceCents, 1_099);
    assert.equal(events[2].previousQuantity, 0);
    assert.equal(events[2].newQuantity, 1);
    assert.equal(events[6].previousQuantity, 2);
    assert.equal(events[6].newQuantity, 1);

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/cancel`,
    });
    assert.equal(cancelResponse.statusCode, 409);

    const closeResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/close`,
    });
    assert.equal(closeResponse.statusCode, 200);
    const closedComanda = closeResponse.json<{
      comanda: {
        closedAt: string | null;
        events: { type: string }[];
        items: { confirmedQuantity: number; quantity: number }[];
        status: string;
        totalCents: number;
      };
    }>().comanda;
    assert.equal(closedComanda.status, "CLOSED");
    assert.ok(closedComanda.closedAt);
    assert.deepEqual(
      closedComanda.items.map(({ confirmedQuantity, quantity }) => ({
        confirmedQuantity,
        quantity,
      })),
      [{ confirmedQuantity: 1, quantity: 1 }],
    );
    assert.equal(closedComanda.totalCents, 1_099);
    assert.equal(closedComanda.events.at(-1)?.type, "CLOSED");

    const persistedClosedComanda = await prisma.comanda.findUniqueOrThrow({
      where: { id: openedComanda.id },
    });
    assert.equal(persistedClosedComanda.status, "CLOSED");
    assert.ok(persistedClosedComanda.closedAt);

    const releasedTable = await prisma.restaurantTable.findUniqueOrThrow({
      where: { id: table.id },
    });
    assert.equal(releasedTable.activeComandaId, null);
    assert.equal(releasedTable.status, "FREE");

    const historicalDetailsResponse = await app.inject({
      method: "GET",
      url: `/comandas/${openedComanda.id}`,
    });
    assert.equal(historicalDetailsResponse.statusCode, 200);
    assert.equal(
      historicalDetailsResponse.json<{ comanda: { totalCents: number } }>().comanda
        .totalCents,
      1_099,
    );

    const secondCloseResponse = await app.inject({
      method: "POST",
      url: `/comandas/${openedComanda.id}/close`,
    });
    assert.equal(secondCloseResponse.statusCode, 409);
  } finally {
    await app.close();
  }
});
