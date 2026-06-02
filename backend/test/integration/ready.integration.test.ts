import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildApp } from "../../src/app.js";
import { createPersistence, createPrismaClient } from "../../src/database.js";

const prisma = createPrismaClient();

before(async () => {
  await prisma.restaurantTable.updateMany({
    data: {
      activeComandaId: null,
      status: "FREE",
    },
  });
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
  await prisma.comandaEvent.deleteMany();
  await prisma.comanda.deleteMany();
  await prisma.$disconnect();
});

void test("GET /ready connects to the configured MySQL database", async () => {
  const { comandas, database, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
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
  const { comandas, database, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
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
        number: number;
      };
    }>().comanda;

    assert.equal(openResponse.statusCode, 201);
    assert.ok(openedComanda.number > 0);

    const persistedOpenTable = await prisma.restaurantTable.findUniqueOrThrow({
      where: { id: table.id },
    });
    assert.equal(persistedOpenTable.status, "OPEN");
    assert.equal(persistedOpenTable.activeComandaId, openedComanda.id);

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
          activeComanda: { id: string; number: number } | null;
          id: number;
          status: string;
        }[];
      }>()
      .tables.find(({ id }) => id === table.id);
    assert.deepEqual(openTable, {
      activeComanda: {
        id: openedComanda.id,
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
  const { comandas, database, restaurantTables } = createPersistence();
  const app = await buildApp({
    comandas,
    database,
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
