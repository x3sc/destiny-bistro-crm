import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import {
  ComandaNotCancellableError,
  ComandaNotFoundError,
  TableNotFoundError,
  TableUnavailableError,
  type Comanda,
  type ComandaRepository,
} from "../../src/comanda-repository.js";
import type { Database } from "../../src/database.js";
import type {
  RestaurantTable,
  RestaurantTableRepository,
} from "../../src/restaurant-table-repository.js";

const openedAt = "2026-06-02T19:00:00.000Z";
const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  events: [
    {
      createdAt: openedAt,
      reason: null,
      type: "OPENED",
    },
  ],
  id: "comanda-id",
  number: 42,
  openedAt,
  status: "OPEN",
  table: {
    id: 1,
    number: 1,
  },
};

function createDatabase(ping: Database["ping"] = () => Promise.resolve()): Database {
  return {
    close: () => Promise.resolve(),
    ping,
  };
}

function createRestaurantTables(
  list: RestaurantTableRepository["list"] = () => Promise.resolve([]),
): RestaurantTableRepository {
  return { list };
}

function createComandas(overrides: Partial<ComandaRepository> = {}): ComandaRepository {
  return {
    cancel: () => Promise.resolve(comanda),
    findById: () => Promise.resolve(comanda),
    openForTable: () => Promise.resolve(comanda),
    ...overrides,
  };
}

async function createApp({
  comandas = createComandas(),
  database = createDatabase(),
  restaurantTables = createRestaurantTables(),
}: {
  comandas?: ComandaRepository;
  database?: Database;
  restaurantTables?: RestaurantTableRepository;
} = {}) {
  return buildApp({
    comandas,
    database,
    restaurantTables,
  });
}

void test("GET /health reports the API status without querying the database", async () => {
  let pingCalls = 0;
  const app = await createApp({
    database: createDatabase(() => {
      pingCalls += 1;
      return Promise.resolve();
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    service: "api",
  });
  assert.equal(pingCalls, 0);

  await app.close();
});

void test("GET /ready reports a connected database", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/ready",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    database: "connected",
  });

  await app.close();
});

void test("GET /ready hides database errors from the client", async () => {
  const app = await createApp({
    database: createDatabase(() => Promise.reject(new Error("internal database detail"))),
  });

  const response = await app.inject({
    method: "GET",
    url: "/ready",
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    status: "error",
    database: "unavailable",
  });
  assert.doesNotMatch(response.body, /internal database detail/);

  await app.close();
});

void test("GET /tables returns restaurant tables ordered by number", async () => {
  const tables: RestaurantTable[] = [
    { activeComanda: null, id: 1, number: 1, status: "FREE" },
    {
      activeComanda: { id: "comanda-id", number: 42 },
      id: 2,
      number: 2,
      status: "OPEN",
    },
  ];
  const app = await createApp({
    restaurantTables: createRestaurantTables(() => Promise.resolve(tables)),
  });

  const response = await app.inject({
    method: "GET",
    url: "/tables",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { tables });

  await app.close();
});

void test("GET /tables hides database errors from the client", async () => {
  const app = await createApp({
    restaurantTables: createRestaurantTables(() =>
      Promise.reject(new Error("internal table query detail")),
    ),
  });

  const response = await app.inject({
    method: "GET",
    url: "/tables",
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Tables unavailable",
  });
  assert.doesNotMatch(response.body, /internal table query detail/);

  await app.close();
});

void test("POST /tables/:tableId/comandas opens a comanda", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/tables/1/comandas",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { comanda });

  await app.close();
});

void test("POST /tables/:tableId/comandas reports a missing table", async () => {
  const app = await createApp({
    comandas: createComandas({
      openForTable: () => Promise.reject(new TableNotFoundError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/tables/999/comandas",
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Table not found",
  });

  await app.close();
});

void test("POST /tables/:tableId/comandas rejects an occupied table", async () => {
  const app = await createApp({
    comandas: createComandas({
      openForTable: () => Promise.reject(new TableUnavailableError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/tables/1/comandas",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Table unavailable",
  });

  await app.close();
});

void test("GET /comandas/:comandaId returns comanda details", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/comandas/comanda-id",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda });

  await app.close();
});

void test("GET /comandas/:comandaId reports a missing comanda", async () => {
  const app = await createApp({
    comandas: createComandas({
      findById: () => Promise.reject(new ComandaNotFoundError()),
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/comandas/missing",
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Comanda not found",
  });

  await app.close();
});

void test("POST /comandas/:comandaId/cancel cancels an open empty comanda", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/comandas/comanda-id/cancel",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda });

  await app.close();
});

void test("POST /comandas/:comandaId/cancel rejects an inactive comanda", async () => {
  const app = await createApp({
    comandas: createComandas({
      cancel: () => Promise.reject(new ComandaNotCancellableError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/comandas/comanda-id/cancel",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Comanda cannot be cancelled",
  });

  await app.close();
});
