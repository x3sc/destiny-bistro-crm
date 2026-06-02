import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import { createDatabase } from "../../src/database.js";

void test("GET /ready connects to the configured MySQL database", async () => {
  const app = await buildApp({
    database: createDatabase(),
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
