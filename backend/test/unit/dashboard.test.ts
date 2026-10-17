import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import type { AuthRepository, AuthUser } from "../../src/auth-repository.js";
import { registerAuthentication } from "../../src/authentication.js";
import { createDashboardRepository } from "../../src/dashboard-repository.js";
import { registerDashboardRoutes } from "../../src/routes/dashboard-routes.js";
import type { KitchenRepository } from "../../src/kitchen-types.js";
import type { RestaurantTableRepository } from "../../src/restaurant-table-repository.js";
import type { StatementRepository } from "../../src/statement-repository.js";

const user: AuthUser = {
  establishment: { id: "establishment-a", name: "Destiny" },
  id: "user-id",
  name: "Operador",
  permissions: ["tables.read", "statements.read"],
  roles: [{ code: "WAITER", id: "role-id", name: "Garcom" }],
};

void test("dashboard uses Sao Paulo day and skips unauthorized queries", async () => {
  const calls: string[] = [];
  const tables = {
    list: (tenant: string) => {
      calls.push("tables:" + tenant);
      return Promise.resolve([
        { activeComanda: null, id: 1, number: 1, status: "OPEN" as const },
        { activeComanda: null, id: 2, number: 2, status: "AWAITING_CHECK" as const },
        { activeComanda: null, id: 3, number: 3, status: "FREE" as const },
      ]);
    },
  } satisfies RestaurantTableRepository;
  const kitchen = {
    findById: () => Promise.reject(new Error("Unexpected query")),
    listOperational: () => Promise.reject(new Error("Unauthorized query")),
    updateStatus: () => Promise.reject(new Error("Unexpected update")),
  } satisfies KitchenRepository;
  const statements = {
    findReport: (tenant, period) => {
      calls.push(["sales", tenant, period.from, period.to].join(":"));
      return Promise.resolve({
        days: [],
        entries: [],
        indicators: {
          averageTicketCents: 0,
          differenceCents: 0,
          originSummaries: [],
          paymentMethodSummaries: [],
          saleCommandCount: 0,
        },
        period: { from: period.from, timeZone: "America/Sao_Paulo" as const, to: period.to },
        summary: {
          cancelledCommandCount: 0,
          closedCommandCount: 2,
          processedCommandCount: 2,
          receivedCents: 9_000,
          receivedItemCount: 3,
          soldCents: 12_500,
          soldItemCount: 3,
        },
      });
    },
  } satisfies StatementRepository;
  const repository = createDashboardRepository(
    tables,
    kitchen,
    statements,
    () => new Date("2026-09-30T02:30:00.000Z"),
  );

  assert.deepEqual(
    await repository.findToday("establishment-a", {
      kitchen: false,
      sales: true,
      tables: true,
    }),
    {
      closedSalesCents: 12_500,
      date: "2026-09-29",
      occupiedTables: 2,
      pendingKitchenTickets: null,
    },
  );
  assert.deepEqual(calls, [
    "tables:establishment-a",
    "sales:establishment-a:2026-09-29:2026-09-29",
  ]);
});

void test("dashboard route maps permissions and null indicators", async () => {
  const auth: AuthRepository = {
    authenticate: () => Promise.resolve(user),
    login: () => Promise.reject(new Error("Unexpected login")),
    logout: () => Promise.resolve(),
  };
  const app = Fastify();
  registerAuthentication(app, auth);
  registerDashboardRoutes(app, {
    findToday: (tenant, permissions) => {
      assert.equal(tenant, "establishment-a");
      assert.deepEqual(permissions, { kitchen: false, sales: true, tables: true });
      return Promise.resolve({
        closedSalesCents: 1_500,
        date: "2026-09-29",
        occupiedTables: 1,
        pendingKitchenTickets: null,
      });
    },
  });
  const response = await app.inject({
    headers: { authorization: "Bearer test-authentication-token" },
    method: "GET",
    url: "/dashboard/today",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    today: {
      closedSalesCents: 1_500,
      date: "2026-09-29",
      occupiedTables: 1,
      pendingKitchenTickets: null,
    },
  });
  await app.close();
});
