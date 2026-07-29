import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import {
  ComandaNotCancellableError,
  ComandaNotClosableError,
  ComandaNotFoundError,
  ComandaItemQuantityError,
  ComandaNotMutableError,
  ProductUnavailableError,
  TableNotFoundError,
  TableUnavailableError,
  type Comanda,
  type ComandaRepository,
} from "../../src/comanda-repository.js";
import {
  CreditOrderConflictError,
  CreditSettlementConflictError,
  normalizeCreditCustomerName,
  type CreditCustomerDetails,
  type CreditCustomerSummary,
  type CreditOrder,
  type CreditRepository,
  type CreditSettlement,
} from "../../src/credit-repository.js";
import type { Database } from "../../src/database.js";
import type { Product, ProductRepository } from "../../src/product-repository.js";
import type {
  RestaurantTable,
  RestaurantTableRepository,
} from "../../src/restaurant-table-repository.js";
import type { StatementReport } from "../../src/statement-report.js";
import type { StatementRepository } from "../../src/statement-repository.js";

const openedAt = "2026-06-02T19:00:00.000Z";
const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [
    {
      createdAt: openedAt,
      itemId: null,
      newQuantity: null,
      previousQuantity: null,
      productId: null,
      productName: null,
      reason: null,
      type: "OPENED",
      unitPriceCents: null,
    },
  ],
  id: "comanda-id",
  items: [],
  name: null,
  number: 42,
  openedAt,
  status: "OPEN",
  table: {
    id: 1,
    number: 1,
  },
  totalCents: 0,
};

const creditCustomer: CreditCustomerSummary = {
  balanceCents: 600,
  draftOrderCount: 0,
  id: "customer-id",
  name: "Maria",
  openOrderCount: 1,
};

const creditOrder: CreditOrder = {
  cancelledAt: null,
  comandaId: "comanda-id",
  comandaName: "Maria",
  comandaNumber: 42,
  customerId: "customer-id",
  customerName: "Maria",
  finalizedAt: openedAt,
  hasPendingItems: false,
  id: "order-id",
  orderedAt: openedAt,
  settledAt: null,
  source: "MANUAL",
  status: "OPEN",
  tableNumber: null,
  totalCents: 600,
};

const creditSettlement: CreditSettlement = {
  amountCents: 600,
  id: "settlement-id",
  orderId: "order-id",
  paidAt: openedAt,
};

const creditCustomerDetails: CreditCustomerDetails = {
  ...creditCustomer,
  orders: [creditOrder],
  settlements: [],
};

const statementReport: StatementReport = {
  days: [
    {
      cancelledCommandCount: 0,
      closedCommandCount: 1,
      date: "2026-07-28",
      processedCommandCount: 1,
      receivedCents: 600,
      receivedItemCount: 1,
      soldCents: 600,
      soldItemCount: 1,
    },
  ],
  entries: [
    {
      comandaId: "comanda-id",
      comandaName: "Maria",
      comandaNumber: 42,
      event: "TABLE_CLOSED",
      id: "entry-id",
      occurredAt: openedAt,
      origin: "TABLE",
      receivedCents: 600,
      receivedItemCount: 1,
      soldCents: 600,
      soldItemCount: 1,
      status: "CLOSED",
      tableNumber: 1,
    },
  ],
  period: {
    from: "2026-07-28",
    timeZone: "America/Sao_Paulo",
    to: "2026-07-28",
  },
  summary: {
    cancelledCommandCount: 0,
    closedCommandCount: 1,
    processedCommandCount: 1,
    receivedCents: 600,
    receivedItemCount: 1,
    soldCents: 600,
    soldItemCount: 1,
  },
};

const comandaWithItem: Comanda = {
  ...comanda,
  events: [
    ...comanda.events,
    {
      createdAt: openedAt,
      itemId: "item-id",
      newQuantity: 1,
      previousQuantity: 0,
      productId: "product-id",
      productName: "Café",
      reason: null,
      type: "ITEM_ADDED",
      unitPriceCents: 600,
    },
  ],
  items: [
    {
      confirmedQuantity: 0,
      createdAt: openedAt,
      id: "item-id",
      productId: "product-id",
      productName: "Café",
      quantity: 1,
      subtotalCents: 600,
      unitPriceCents: 600,
    },
  ],
  totalCents: 600,
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
    addItem: () => Promise.resolve(comandaWithItem),
    cancel: () => Promise.resolve(comanda),
    changeItemQuantity: () => Promise.resolve(comandaWithItem),
    close: () => Promise.resolve(comanda),
    confirmItem: () => Promise.resolve(comandaWithItem),
    findById: () => Promise.resolve(comanda),
    openForTable: () => Promise.resolve(comanda),
    removeItem: () => Promise.resolve(comanda),
    ...overrides,
  };
}

function createCredits(overrides: Partial<CreditRepository> = {}): CreditRepository {
  return {
    cancelOrder: () => Promise.resolve({ ...creditOrder, status: "CANCELLED" }),
    convertComanda: () => Promise.resolve({ ...creditOrder, source: "TABLE" }),
    createCustomer: () => Promise.resolve(creditCustomer),
    createOrder: () => Promise.resolve({ ...creditOrder, status: "DRAFT" }),
    finalizeOrder: () => Promise.resolve(creditOrder),
    findCustomer: () => Promise.resolve(creditCustomerDetails),
    listCustomers: () => Promise.resolve([creditCustomer]),
    settleOrder: () => Promise.resolve(creditSettlement),
    ...overrides,
  };
}

function createProducts(
  listActive: ProductRepository["listActive"] = () => Promise.resolve([]),
): ProductRepository {
  return { listActive };
}

function createStatements(
  findReport: StatementRepository["findReport"] = () =>
    Promise.resolve(statementReport),
): StatementRepository {
  return { findReport };
}

async function createApp({
  comandas = createComandas(),
  credits = createCredits(),
  database = createDatabase(),
  products = createProducts(),
  restaurantTables = createRestaurantTables(),
  statements = createStatements(),
}: {
  comandas?: ComandaRepository;
  credits?: CreditRepository;
  database?: Database;
  products?: ProductRepository;
  restaurantTables?: RestaurantTableRepository;
  statements?: StatementRepository;
} = {}) {
  return buildApp({
    comandas,
    credits,
    database,
    products,
    restaurantTables,
    statements,
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
      activeComanda: { id: "comanda-id", name: "João", number: 42 },
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

void test("GET /products returns active products ordered by name", async () => {
  const products: Product[] = [
    {
      category: "CLASSIC_BURGERS",
      id: "coffee-id",
      name: "Café",
      priceCents: 600,
    },
    {
      category: "BEVERAGES",
      id: "water-id",
      name: "Água",
      priceCents: 500,
    },
  ];
  const app = await createApp({
    products: createProducts(() => Promise.resolve(products)),
  });

  const response = await app.inject({
    method: "GET",
    url: "/products",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { products });

  await app.close();
});

void test("OPTIONS allows item mutation methods for browser clients", async () => {
  const app = await createApp();

  const response = await app.inject({
    headers: {
      "access-control-request-method": "DELETE",
      origin: "http://localhost:8081",
    },
    method: "OPTIONS",
    url: "/comandas/comanda-id/items/item-id",
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:8081");
  assert.match(String(response.headers["access-control-allow-methods"]), /DELETE/);
  assert.match(String(response.headers["access-control-allow-methods"]), /PATCH/);

  await app.close();
});

void test("GET /products hides database errors from the client", async () => {
  const app = await createApp({
    products: createProducts(() => Promise.reject(new Error("internal product detail"))),
  });

  const response = await app.inject({
    method: "GET",
    url: "/products",
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Products unavailable",
  });
  assert.doesNotMatch(response.body, /internal product detail/);

  await app.close();
});

void test("POST /tables/:tableId/comandas opens a comanda", async () => {
  let receivedName: string | null | undefined;
  const app = await createApp({
    comandas: createComandas({
      openForTable: (_tableId, name) => {
        receivedName = name;
        return Promise.resolve({ ...comanda, name });
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      name: "  João  ",
    },
    url: "/tables/1/comandas",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedName, "João");
  assert.deepEqual(response.json(), { comanda: { ...comanda, name: "João" } });

  await app.close();
});

void test("POST /tables/:tableId/comandas rejects invalid names", async () => {
  let openCalls = 0;
  const app = await createApp({
    comandas: createComandas({
      openForTable: () => {
        openCalls += 1;
        return Promise.resolve(comanda);
      },
    }),
  });

  const invalidTypeResponse = await app.inject({
    method: "POST",
    payload: {
      name: 42,
    },
    url: "/tables/1/comandas",
  });
  const tooLongResponse = await app.inject({
    method: "POST",
    payload: {
      name: "a".repeat(81),
    },
    url: "/tables/1/comandas",
  });

  assert.equal(invalidTypeResponse.statusCode, 409);
  assert.equal(tooLongResponse.statusCode, 409);
  assert.equal(openCalls, 0);

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

void test("POST /comandas/:comandaId/close closes a comanda", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/comandas/comanda-id/close",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda });

  await app.close();
});

void test("POST /comandas/:comandaId/close rejects comandas with pending items", async () => {
  const app = await createApp({
    comandas: createComandas({
      close: () => Promise.reject(new ComandaNotClosableError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/comandas/comanda-id/close",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Comanda cannot be closed",
  });

  await app.close();
});

void test("POST /comandas/:comandaId/items adds a product to the comanda", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    payload: {
      productId: "product-id",
    },
    url: "/comandas/comanda-id/items",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda: comandaWithItem });

  await app.close();
});

void test("POST /comandas/:comandaId/items rejects unavailable products", async () => {
  const app = await createApp({
    comandas: createComandas({
      addItem: () => Promise.reject(new ProductUnavailableError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      productId: "inactive-product",
    },
    url: "/comandas/comanda-id/items",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Comanda item cannot be changed",
  });

  await app.close();
});

void test("PATCH /comandas/:comandaId/items/:itemId changes item quantity", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "PATCH",
    payload: {
      delta: 1,
    },
    url: "/comandas/comanda-id/items/item-id",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda: comandaWithItem });

  await app.close();
});

void test("POST /comandas/:comandaId/items/:itemId/confirm confirms item quantity", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/comandas/comanda-id/items/item-id/confirm",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda: comandaWithItem });

  await app.close();
});

void test("PATCH /comandas/:comandaId/items/:itemId rejects invalid quantity changes", async () => {
  const app = await createApp({
    comandas: createComandas({
      changeItemQuantity: () => Promise.reject(new ComandaItemQuantityError()),
    }),
  });

  const response = await app.inject({
    method: "PATCH",
    payload: {
      delta: -1,
    },
    url: "/comandas/comanda-id/items/item-id",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Comanda item cannot be changed",
  });

  await app.close();
});

void test("DELETE /comandas/:comandaId/items/:itemId removes a single unit item", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "DELETE",
    url: "/comandas/comanda-id/items/item-id",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda });

  await app.close();
});

void test("DELETE /comandas/:comandaId/items/:itemId rejects inactive comandas", async () => {
  const app = await createApp({
    comandas: createComandas({
      removeItem: () => Promise.reject(new ComandaNotMutableError()),
    }),
  });

  const response = await app.inject({
    method: "DELETE",
    url: "/comandas/comanda-id/items/item-id",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Comanda item cannot be changed",
  });

  await app.close();
});

void test("credit customer names normalize spaces and case without removing accents", () => {
  assert.deepEqual(normalizeCreditCustomerName("  MARIA   José  "), {
    name: "MARIA José",
    normalizedName: "maria josé",
  });
});

void test("GET /credit-customers returns grouped balances", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/credit-customers",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    customers: [creditCustomer],
  });

  await app.close();
});

void test("POST /credit-customers creates or reuses a person", async () => {
  let receivedName = "";
  const app = await createApp({
    credits: createCredits({
      createCustomer: (name) => {
        receivedName = name;
        return Promise.resolve(creditCustomer);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      name: " Maria ",
    },
    url: "/credit-customers",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedName, " Maria ");
  assert.deepEqual(response.json(), {
    customer: creditCustomer,
  });

  await app.close();
});

void test("POST /credit-customers/:customerId/orders creates a manual draft", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/credit-customers/customer-id/orders",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    order: {
      ...creditOrder,
      status: "DRAFT",
    },
  });

  await app.close();
});

void test("POST /credit-orders/:orderId/finalize rejects pending drafts", async () => {
  const app = await createApp({
    credits: createCredits({
      finalizeOrder: () => Promise.reject(new CreditOrderConflictError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/credit-orders/order-id/finalize",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Credit order cannot be changed",
  });

  await app.close();
});

void test("POST /comandas/:comandaId/credit converts a table order", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    payload: {
      customerId: "customer-id",
    },
    url: "/comandas/comanda-id/credit",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    order: {
      ...creditOrder,
      source: "TABLE",
    },
  });

  await app.close();
});

void test("POST /credit-orders/:orderId/settle rejects a second settlement", async () => {
  const app = await createApp({
    credits: createCredits({
      settleOrder: () => Promise.reject(new CreditSettlementConflictError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/credit-orders/order-id/settle",
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "error",
    message: "Credit balance cannot be settled",
  });

  await app.close();
});

void test("GET /statements returns the inclusive requested period", async () => {
  let receivedStartAt = "";
  let receivedEndAt = "";
  const app = await createApp({
    statements: createStatements((period) => {
      receivedStartAt = period.startAt.toISOString();
      receivedEndAt = period.endAt.toISOString();
      return Promise.resolve(statementReport);
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/statements?from=2026-07-28&to=2026-07-28",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedStartAt, "2026-07-28T03:00:00.000Z");
  assert.equal(receivedEndAt, "2026-07-29T03:00:00.000Z");
  assert.deepEqual(response.json(), {
    statement: statementReport,
  });

  await app.close();
});

void test("GET /statements rejects invalid periods before querying persistence", async () => {
  let queryCalls = 0;
  const app = await createApp({
    statements: createStatements(() => {
      queryCalls += 1;
      return Promise.resolve(statementReport);
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/statements?from=2026-07-30&to=2026-07-28",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(queryCalls, 0);
  assert.deepEqual(response.json(), {
    message: "Invalid statement period",
    status: "error",
  });

  await app.close();
});

void test("GET /statements/export.pdf returns a named PDF document", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /^application\/pdf/);
  assert.equal(
    response.headers["content-disposition"],
    'attachment; filename="extrato-2026-07-28-a-2026-07-28.pdf"',
  );
  assert.equal(response.rawPayload.subarray(0, 4).toString(), "%PDF");

  await app.close();
});
