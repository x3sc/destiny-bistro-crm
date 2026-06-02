import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import type { Database } from "../../src/database.js";

function createDatabase(ping: Database["ping"] = () => Promise.resolve()) {
  return {
    close: () => Promise.resolve(),
    ping,
  };
}

void test("GET /health reports the API status without querying the database", async () => {
  let pingCalls = 0;
  const app = await buildApp({
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

void test("GET /ready hides database errors from the client", async () => {
  const app = await buildApp({
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
