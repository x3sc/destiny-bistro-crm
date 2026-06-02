import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import type { Database } from "../../src/database.js";
import type {
  RestaurantTable,
  RestaurantTableRepository,
} from "../../src/restaurant-table-repository.js";

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

void test("GET /health reports the API status without querying the database", async () => {
  let pingCalls = 0;
  const app = await buildApp({
    database: createDatabase(() => {
      pingCalls += 1;
      return Promise.resolve();
    }),
    restaurantTables: createRestaurantTables(),
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
  const app = await buildApp({
    database: createDatabase(),
    restaurantTables: createRestaurantTables(),
  });

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
  const app = await buildApp({
    database: createDatabase(() => Promise.reject(new Error("internal database detail"))),
    restaurantTables: createRestaurantTables(),
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
    { id: 1, number: 1, status: "FREE" },
    { id: 2, number: 2, status: "OPEN" },
    { id: 3, number: 3, status: "AWAITING_CHECK" },
  ];
  const app = await buildApp({
    database: createDatabase(),
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

void test("GET /tables returns an empty list when no table exists", async () => {
  const app = await buildApp({
    database: createDatabase(),
    restaurantTables: createRestaurantTables(),
  });

  const response = await app.inject({
    method: "GET",
    url: "/tables",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { tables: [] });

  await app.close();
});

void test("GET /tables hides database errors from the client", async () => {
  const app = await buildApp({
    database: createDatabase(),
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
