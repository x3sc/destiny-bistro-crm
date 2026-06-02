import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import { createPersistence } from "../../src/database.js";

interface TablesResponse {
  tables: {
    id: number;
    number: number;
    status: string;
  }[];
}

void test("GET /ready connects to the configured MySQL database", async () => {
  const { database, restaurantTables } = createPersistence();
  const app = await buildApp({
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

void test("GET /tables returns the seeded restaurant tables", async () => {
  const { database, restaurantTables } = createPersistence();
  const app = await buildApp({
    database,
    restaurantTables,
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/tables",
    });
    const body = response.json<TablesResponse>();

    assert.equal(response.statusCode, 200);
    assert.equal(body.tables.length, 12);
    assert.equal(new Set(body.tables.map(({ id }) => id)).size, 12);
    assert.deepEqual(
      body.tables.map(({ number, status }) => ({
        number,
        status,
      })),
      Array.from({ length: 12 }, (_, index) => ({
        number: index + 1,
        status: "FREE",
      })),
    );
  } finally {
    await app.close();
  }
});
