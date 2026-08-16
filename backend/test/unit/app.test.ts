import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../src/app.js";
import {
  AuthCredentialsError,
  type AuthRepository,
  type AuthUser,
} from "../../src/auth-repository.js";
import {
  ComandaNotCancellableError,
  ComandaNotClosableError,
  ComandaNotFoundError,
  ComandaCreditPermissionError,
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
} from "../../src/credit-repository.js";
import type { Payment } from "../../src/payment-types.js";
import type { Database } from "../../src/database.js";
import {
  DeliveryCourierConflictError,
  DeliveryDayConflictError,
  type DeliveryCourierDetails,
  type DeliveryDayDetails,
  type DeliveryOrder,
  type DeliveryOrderInput,
  type DeliveryRepository,
} from "../../src/delivery-repository.js";
import {
  InventoryBalanceError,
  InventoryStockNotFoundError,
  type InventoryItem,
  type InventoryMovement,
  type InventoryRepository,
} from "../../src/inventory-repository.js";
import type {
  MenuCategory,
  Product,
  ProductRepository,
} from "../../src/product-repository.js";
import type {
  RestaurantTable,
  RestaurantTableRepository,
} from "../../src/restaurant-table-repository.js";
import type { StatementReport } from "../../src/statement-report.js";
import type { StatementRepository } from "../../src/statement-repository.js";

const openedAt = "2026-06-02T19:00:00.000Z";
const authenticatedUser: AuthUser = {
  establishment: {
    id: "establishment-id",
    name: "Destiny Bistro",
  },
  id: "user-id",
  name: "Operador",
  permissions: [
    "comandas.read",
    "comandas.write",
    "credits.read",
    "credits.write",
    "deliveries.read",
    "deliveries.write",
    "inventory.read",
    "inventory.write",
    "products.read",
    "products.write",
    "statements.read",
    "tables.read",
  ],
  roles: [
    {
      code: "OWNER",
      id: "role-id",
      name: "Dono",
    },
  ],
};
const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [
    {
      actor: null,
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
  payments: [],
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
  balanceCents: 600,
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
  paidCents: 0,
  payments: [],
  settledAt: null,
  source: "MANUAL",
  status: "OPEN",
  tableNumber: null,
  totalCents: 600,
};

const creditPayment: Payment = {
  allocations: [{ amountCents: 600, id: "allocation-id", method: "PIX" }],
  amountCents: 600,
  comandaId: "credit-comanda-id",
  creditOrderId: "order-id",
  id: "payment-id",
  origin: "CREDIT_INSTALLMENT",
  paidAt: openedAt,
  recordedBy: { id: "user-id", name: "Operador" },
};

const inventoryItem: InventoryItem = {
  id: "stock-id",
  ingredient: {
    active: true,
    code: "CAFE",
    id: "ingredient-id",
    name: "Café",
    unit: "GRAM",
  },
  lowStock: true,
  minimumQuantity: 500,
  quantity: 250,
  updatedAt: openedAt,
};

const inventoryMovement: InventoryMovement = {
  balanceAfter: 1250,
  createdAt: openedAt,
  id: "movement-id",
  quantityDelta: 1000,
  reason: "Compra semanal",
  stockId: "stock-id",
  type: "ENTRY",
};

const deliveryDay: DeliveryDayDetails = {
  closedAt: null,
  courierId: "courier-id",
  courierName: "Entregador",
  dailyRateCents: 8000,
  deliveries: [],
  deliveryCount: 0,
  expenses: [],
  expensesTotalCents: 0,
  feesTotalCents: 0,
  id: "day-id",
  openedAt,
  payoutCents: 8000,
  salesTotalCents: 0,
  settlementPaidCents: null,
  status: "OPEN",
};

const deliveryCourier: DeliveryCourierDetails = {
  activeDayId: "day-id",
  days: [],
  id: "courier-id",
  name: "Entregador",
  periodPayoutCents: 0,
  periodSettledCents: 0,
  settledTotalCents: 0,
};

const deliveryOrder: DeliveryOrder = {
  address: "Rua A, 1",
  comandaId: "delivery-comanda-id",
  comandaNumber: 43,
  courierName: null,
  createdAt: openedAt,
  customerName: "Cliente",
  dayId: null,
  deliveredAt: null,
  dispatchedAt: null,
  feeCents: 500,
  hasPendingItems: false,
  id: "delivery-order-id",
  itemCount: 1,
  paidCents: 0,
  paymentStatus: "OPEN",
  phone: "11999999999",
  status: "NEW",
  totalCents: 1_500,
  updatedAt: openedAt,
};

const menuCategory: MenuCategory = {
  active: true,
  id: "category-id",
  name: "Bebidas",
  products: [
    {
      active: true,
      description: "Copo 300 ml",
      id: "product-id",
      name: "Suco de laranja",
      priceCents: 900,
    },
  ],
};

const creditCustomerDetails: CreditCustomerDetails = {
  ...creditCustomer,
  orders: [creditOrder],
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
      creditBalanceAfterCents: null,
      creditPaidAfterCents: null,
      creditPaidBeforeCents: null,
      creditTotalCents: null,
      customerName: null,
      deliveryAddress: null,
      deliveryFeeCents: null,
      event: "TABLE_CLOSED",
      id: "entry-id",
      items: [
        {
          productId: "product-id",
          productName: "Café",
          quantity: 1,
          unitPriceCents: 600,
        },
      ],
      occurredAt: openedAt,
      origin: "TABLE",
      payments: [],
      paymentOrigin: null,
      receivedCents: 600,
      receivedItemCount: 1,
      soldCents: 600,
      soldItemCount: 1,
      status: "CLOSED",
      tableNumber: 1,
      tableCheckoutPaidCents: null,
    },
  ],
  indicators: {
    averageTicketCents: 600,
    differenceCents: 0,
    originSummaries: [
      {
        movementCount: 1,
        origin: "TABLE",
        receivedCents: 600,
        receivedItemCount: 1,
        soldCents: 600,
        soldItemCount: 1,
      },
      {
        movementCount: 0,
        origin: "CREDIT_MANUAL",
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
      {
        movementCount: 0,
        origin: "CREDIT_TABLE",
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
    ],
    paymentMethodSummaries: [
      { method: "CASH", receivedCents: 0 },
      { method: "PIX", receivedCents: 0 },
      { method: "DEBIT_CARD", receivedCents: 0 },
      { method: "CREDIT_CARD", receivedCents: 0 },
      { method: "UNSPECIFIED", receivedCents: 600 },
    ],
    saleCommandCount: 1,
  },
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
      actor: null,
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

function createAuth(
  overrides: Partial<AuthRepository> = {},
): AuthRepository {
  return {
    authenticate: () => Promise.resolve(authenticatedUser),
    login: () =>
      Promise.resolve({
        expiresAt: "2026-06-03T07:00:00.000Z",
        token: "test-authentication-token",
        user: authenticatedUser,
      }),
    logout: () => Promise.resolve(),
    ...overrides,
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
    settleOrder: () =>
      Promise.resolve({
        order: { ...creditOrder, balanceCents: 0, paidCents: 600, status: "SETTLED" },
        payment: creditPayment,
      }),
    ...overrides,
  };
}

function createProducts(
  overrides: Partial<ProductRepository> = {},
): ProductRepository {
  return {
    createCategory: () => Promise.resolve(menuCategory),
    createProduct: () => Promise.resolve(menuCategory.products[0]),
    deactivateCategory: () => Promise.resolve(menuCategory),
    deactivateProduct: () => Promise.resolve(menuCategory.products[0]),
    listActive: () => Promise.resolve([]),
    listMenu: () => Promise.resolve([menuCategory]),
    updateCategory: () => Promise.resolve(menuCategory),
    updateProduct: () => Promise.resolve(menuCategory.products[0]),
    ...overrides,
  };
}

function createInventory(
  overrides: Partial<InventoryRepository> = {},
): InventoryRepository {
  return {
    createIngredient: () => Promise.resolve(inventoryItem),
    createMovement: () => Promise.resolve(inventoryMovement),
    list: () => Promise.resolve([inventoryItem]),
    ...overrides,
  };
}

function createDeliveries(
  overrides: Partial<DeliveryRepository> = {},
): DeliveryRepository {
  return {
    addExpense: () => Promise.resolve(deliveryDay),
    advanceOrder: () => Promise.resolve(deliveryOrder),
    closeDay: () => Promise.resolve(deliveryDay),
    createCourier: () =>
      Promise.resolve({
        activeDayId: null,
        id: deliveryCourier.id,
        name: deliveryCourier.name,
        settledTotalCents: 0,
      }),
    createOrder: () => Promise.resolve(deliveryOrder),
    findCourier: () => Promise.resolve(deliveryCourier),
    findDay: () => Promise.resolve(deliveryDay),
    findOrder: () => Promise.resolve(deliveryOrder),
    listCouriers: () =>
      Promise.resolve([
        {
          activeDayId: deliveryCourier.activeDayId,
          id: deliveryCourier.id,
          name: deliveryCourier.name,
          settledTotalCents: 0,
        },
      ]),
    listOrders: () => Promise.resolve([deliveryOrder]),
    openDay: () => Promise.resolve(deliveryDay),
    recordDelivery: () => Promise.resolve(deliveryDay),
    ...overrides,
  };
}

function createStatements(
  findReport: StatementRepository["findReport"] = () =>
    Promise.resolve(statementReport),
): StatementRepository {
  return { findReport };
}

async function createApp({
  auth = createAuth(),
  comandas = createComandas(),
  credits = createCredits(),
  database = createDatabase(),
  deliveries = createDeliveries(),
  inventory = createInventory(),
  products = createProducts(),
  restaurantTables = createRestaurantTables(),
  statements = createStatements(),
}: {
  auth?: AuthRepository;
  comandas?: ComandaRepository;
  credits?: CreditRepository;
  database?: Database;
  deliveries?: DeliveryRepository;
  inventory?: InventoryRepository;
  products?: ProductRepository;
  restaurantTables?: RestaurantTableRepository;
  statements?: StatementRepository;
} = {}) {
  const app = await buildApp({
    auth,
    comandas,
    credits,
    database,
    deliveries,
    inventory,
    products,
    restaurantTables,
    statements,
  });

  const inject = app.inject.bind(app);
  app.inject = ((options: unknown) => {
    if (!options || typeof options !== "object") {
      return inject(options as string);
    }

    const request = options as {
      headers?: Record<string, string>;
    };

    return inject({
      ...request,
      headers: {
        authorization: "Bearer test-authentication-token",
        ...request.headers,
      },
    });
  }) as typeof app.inject;

  return app;
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

void test("protected routes reject missing sessions", async () => {
  const app = await createApp();
  const response = await app.inject({
    headers: {
      authorization: "",
    },
    method: "GET",
    url: "/tables",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    message: "Authentication required",
    status: "error",
  });

  await app.close();
});

void test("protected routes reject users without the required permission", async () => {
  const app = await createApp({
    auth: createAuth({
      authenticate: () =>
        Promise.resolve({
          ...authenticatedUser,
          permissions: [],
        }),
    }),
  });
  const response = await app.inject({
    method: "GET",
    url: "/tables",
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    message: "Permission denied",
    status: "error",
  });

  await app.close();
});

void test("POST /auth/login returns a generic error for invalid credentials", async () => {
  const app = await createApp({
    auth: createAuth({
      login: () => Promise.reject(new AuthCredentialsError()),
    }),
  });
  const response = await app.inject({
    method: "POST",
    payload: {
      name: "Operador",
      password: "wrong-password",
    },
    url: "/auth/login",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    message: "Invalid name or password",
    status: "error",
  });

  await app.close();
});

void test("GET /auth/me exposes only the authenticated user contract", async () => {
  const app = await createApp();
  const response = await app.inject({
    method: "GET",
    url: "/auth/me",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    user: authenticatedUser,
  });

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
      category: { id: "category-food", name: "Lanches" },
      description: null,
      id: "coffee-id",
      name: "Café",
      priceCents: 600,
    },
    {
      category: { id: "category-drinks", name: "Bebidas" },
      description: "Sem gas",
      id: "water-id",
      name: "Água",
      priceCents: 500,
    },
  ];
  const app = await createApp({
    products: createProducts({ listActive: () => Promise.resolve(products) }),
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
    products: createProducts({
      listActive: () => Promise.reject(new Error("internal product detail")),
    }),
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

void test("GET /admin/menu returns categories and inactive products", async () => {
  let receivedEstablishmentId = "";
  const app = await createApp({
    products: createProducts({
      listMenu: (establishmentId) => {
        receivedEstablishmentId = establishmentId;
        return Promise.resolve([menuCategory]);
      },
    }),
  });

  const response = await app.inject({ method: "GET", url: "/admin/menu" });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedEstablishmentId, "establishment-id");
  assert.deepEqual(response.json(), { categories: [menuCategory] });
  await app.close();
});

void test("POST /admin/categories creates an audited tenant category", async () => {
  const app = await createApp({
    products: createProducts({
      createCategory: (establishmentId, input, actorUserId) => {
        assert.equal(establishmentId, "establishment-id");
        assert.equal(actorUserId, "user-id");
        assert.deepEqual(input, { name: "Porcoes" });
        return Promise.resolve(menuCategory);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: { name: "Porcoes" },
    url: "/admin/categories",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { category: menuCategory });
  await app.close();
});

void test("POST /admin/products creates an item in a tenant category", async () => {
  const app = await createApp({
    products: createProducts({
      createProduct: (establishmentId, input, actorUserId) => {
        assert.equal(establishmentId, "establishment-id");
        assert.equal(actorUserId, "user-id");
        assert.deepEqual(input, {
          categoryId: "category-id",
          description: "Copo 300 ml",
          name: "Suco de laranja",
          priceCents: 900,
        });
        return Promise.resolve(menuCategory.products[0]);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      categoryId: "category-id",
      description: "Copo 300 ml",
      name: "Suco de laranja",
      priceCents: 900,
    },
    url: "/admin/products",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { product: menuCategory.products[0] });
  await app.close();
});

void test("admin menu mutations validate values before persistence", async () => {
  let createCalls = 0;
  const app = await createApp({
    products: createProducts({
      createProduct: () => {
        createCalls += 1;
        return Promise.resolve(menuCategory.products[0]);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      categoryId: "category-id",
      description: null,
      name: "",
      priceCents: 0,
    },
    url: "/admin/products",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(createCalls, 0);
  await app.close();
});

void test("GET /inventory returns only the authenticated establishment stock", async () => {
  let receivedEstablishmentId = "";
  const app = await createApp({
    inventory: createInventory({
      list: (establishmentId) => {
        receivedEstablishmentId = establishmentId;
        return Promise.resolve([inventoryItem]);
      },
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/inventory",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedEstablishmentId, "establishment-id");
  assert.deepEqual(response.json(), { inventory: [inventoryItem] });

  await app.close();
});

void test("POST /ingredients creates stock inside the authenticated establishment", async () => {
  let receivedEstablishmentId = "";
  let receivedActorUserId = "";
  const app = await createApp({
    inventory: createInventory({
      createIngredient: (establishmentId, input, actorUserId) => {
        receivedEstablishmentId = establishmentId;
        receivedActorUserId = actorUserId;
        assert.deepEqual(input, {
          code: "CAFE",
          minimumQuantity: 500,
          name: "Café",
          unit: "GRAM",
        });
        return Promise.resolve(inventoryItem);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      code: "CAFE",
      minimumQuantity: 500,
      name: "Café",
      unit: "GRAM",
    },
    url: "/ingredients",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedEstablishmentId, "establishment-id");
  assert.equal(receivedActorUserId, "user-id");
  assert.deepEqual(response.json(), { inventoryItem });

  await app.close();
});

void test("POST /inventory/:stockId/movements records an audited tenant movement", async () => {
  const app = await createApp({
    inventory: createInventory({
      createMovement: (establishmentId, stockId, input, actorUserId) => {
        assert.equal(establishmentId, "establishment-id");
        assert.equal(stockId, "stock-id");
        assert.equal(actorUserId, "user-id");
        assert.deepEqual(input, {
          quantityDelta: 1000,
          reason: "Compra semanal",
          type: "ENTRY",
        });
        return Promise.resolve(inventoryMovement);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      quantityDelta: 1000,
      reason: "Compra semanal",
      type: "ENTRY",
    },
    url: "/inventory/stock-id/movements",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { movement: inventoryMovement });

  await app.close();
});

void test("inventory movement reports tenant misses and negative balances", async () => {
  const missingApp = await createApp({
    inventory: createInventory({
      createMovement: () => Promise.reject(new InventoryStockNotFoundError()),
    }),
  });
  const missingResponse = await missingApp.inject({
    method: "POST",
    payload: {
      quantityDelta: 1,
      reason: "Entrada",
      type: "ENTRY",
    },
    url: "/inventory/other-tenant-stock/movements",
  });

  assert.equal(missingResponse.statusCode, 404);
  await missingApp.close();

  const balanceApp = await createApp({
    inventory: createInventory({
      createMovement: () => Promise.reject(new InventoryBalanceError()),
    }),
  });
  const balanceResponse = await balanceApp.inject({
    method: "POST",
    payload: {
      quantityDelta: -300,
      reason: "Consumo",
      type: "EXIT",
    },
    url: "/inventory/stock-id/movements",
  });

  assert.equal(balanceResponse.statusCode, 409);
  assert.deepEqual(balanceResponse.json(), {
    message: "Inventory balance cannot be negative",
    status: "error",
  });
  await balanceApp.close();
});

void test("POST /tables/:tableId/comandas opens a comanda", async () => {
  let receivedName: string | null | undefined;
  const app = await createApp({
    comandas: createComandas({
      openForTable: (establishmentId, _tableId, name) => {
        assert.equal(establishmentId, "establishment-id");
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
  const calls: unknown[][] = [];
  const app = await createApp({
    comandas: createComandas({
      close: (...args) => {
        calls.push(args);
        return Promise.resolve(comanda);
      },
    }),
  });

  const response = await app.inject({
    payload: {
      payments: [
        { amountCents: 200, method: "PIX" },
        { amountCents: 400, method: "CASH" },
      ],
    },
    method: "POST",
    url: "/comandas/comanda-id/close",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { comanda });
  assert.deepEqual(calls[0], [
    "establishment-id",
    "comanda-id",
    [
      { amountCents: 400, method: "CASH" },
      { amountCents: 200, method: "PIX" },
    ],
    null,
    true,
    "user-id",
  ]);

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
      createCustomer: (establishmentId, name) => {
        assert.equal(establishmentId, "establishment-id");
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
    statements: createStatements((establishmentId, period) => {
      assert.equal(establishmentId, "establishment-id");
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

void test("GET /statements/export.pdf returns a named PDF for each view", async () => {
  const app = await createApp();

  const summaryResponse = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28&view=summary",
  });

  assert.equal(summaryResponse.statusCode, 200);
  assert.match(summaryResponse.headers["content-type"] ?? "", /^application\/pdf/);
  assert.equal(
    summaryResponse.headers["content-disposition"],
    'attachment; filename="extrato-resumido-2026-07-28-a-2026-07-28.pdf"',
  );
  assert.equal(summaryResponse.rawPayload.subarray(0, 4).toString(), "%PDF");

  const detailedResponse = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28",
  });

  assert.equal(detailedResponse.statusCode, 200);
  assert.equal(
    detailedResponse.headers["content-disposition"],
    'attachment; filename="extrato-detalhado-2026-07-28-a-2026-07-28.pdf"',
  );

  const filteredDetailedResponse = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28&view=detailed&movementType=RECEIPTS&origin=TABLE",
  });
  assert.equal(filteredDetailedResponse.statusCode, 200);

  const invalidResponse = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28&view=unknown",
  });
  assert.equal(invalidResponse.statusCode, 400);

  const invalidMovementResponse = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28&movementType=UNKNOWN",
  });
  assert.equal(invalidMovementResponse.statusCode, 400);

  const invalidOriginResponse = await app.inject({
    method: "GET",
    url: "/statements/export.pdf?from=2026-07-28&to=2026-07-28&origin=UNKNOWN",
  });
  assert.equal(invalidOriginResponse.statusCode, 400);

  await app.close();
});

void test("credit balance at checkout requires credits.write", async () => {
  const app = await createApp({
    auth: createAuth({
      authenticate: () =>
        Promise.resolve({
          ...authenticatedUser,
          permissions: ["comandas.write"],
        }),
    }),
    comandas: createComandas({
      close: () => Promise.reject(new ComandaCreditPermissionError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: { customerId: "customer-id", payments: [] },
    url: "/comandas/comanda-id/close",
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    message: "Permission denied",
    status: "error",
  });

  await app.close();
});

void test("payment routes reject malformed allocations before persistence", async () => {
  let closeCalled = false;
  let settleCalled = false;
  const app = await createApp({
    comandas: createComandas({
      close: () => {
        closeCalled = true;
        return Promise.resolve(comanda);
      },
    }),
    credits: createCredits({
      settleOrder: () => {
        settleCalled = true;
        return Promise.resolve({ order: creditOrder, payment: creditPayment });
      },
    }),
  });

  const closeResponse = await app.inject({
    method: "POST",
    payload: { payments: [{ amountCents: -1, method: "PIX" }] },
    url: "/comandas/comanda-id/close",
  });
  const settleResponse = await app.inject({
    method: "POST",
    payload: { payments: [{ amountCents: 100, method: "CHEQUE" }] },
    url: "/credit-orders/order-id/settle",
  });

  assert.equal(closeResponse.statusCode, 400);
  assert.equal(settleResponse.statusCode, 400);
  assert.equal(closeCalled, false);
  assert.equal(settleCalled, false);

  await app.close();
});

void test("GET /delivery/couriers lists couriers with their open day", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/delivery/couriers",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    couriers: [
      {
        activeDayId: "day-id",
        id: "courier-id",
        name: "Entregador",
        settledTotalCents: 0,
      },
    ],
  });

  await app.close();
});

void test("POST /delivery/couriers rejects duplicated couriers", async () => {
  const app = await createApp({
    deliveries: createDeliveries({
      createCourier: () => Promise.reject(new DeliveryCourierConflictError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: { name: "Joao" },
    url: "/delivery/couriers",
  });

  assert.equal(response.statusCode, 409);

  await app.close();
});

void test("POST /delivery/couriers/:courierId/days rejects a second open day", async () => {
  const app = await createApp({
    deliveries: createDeliveries({
      openDay: () => Promise.reject(new DeliveryDayConflictError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: { dailyRateCents: 8_000 },
    url: "/delivery/couriers/courier-id/days",
  });

  assert.equal(response.statusCode, 409);

  await app.close();
});

void test("delivery routes reject malformed values before persistence", async () => {
  let recorded = false;
  const app = await createApp({
    deliveries: createDeliveries({
      recordDelivery: () => {
        recorded = true;
        return Promise.resolve(deliveryDay);
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    payload: {
      address: "Rua A, 1",
      customerName: "Cliente",
      feeCents: 500,
      paymentMethod: "BITCOIN",
      totalCents: 1_000,
    },
    url: "/delivery/days/day-id/deliveries",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(recorded, false);

  const invalidFeeResponse = await app.inject({
    method: "POST",
    payload: {
      address: "Rua A, 1",
      customerName: "Cliente",
      feeCents: 1_001,
      paymentMethod: "PIX",
      totalCents: 1_000,
    },
    url: "/delivery/days/day-id/deliveries",
  });

  assert.equal(invalidFeeResponse.statusCode, 400);
  assert.deepEqual(invalidFeeResponse.json(), {
    status: "error",
    message: "Invalid delivery",
  });
  assert.equal(recorded, false);

  await app.close();
});

void test("GET /delivery/orders lists active operational orders", async () => {
  const app = await createApp();
  const response = await app.inject({ method: "GET", url: "/delivery/orders" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { orders: [deliveryOrder] });
  await app.close();
});

void test("POST /delivery/orders creates a comanda-backed order", async () => {
  let receivedInput: DeliveryOrderInput | undefined;
  const app = await createApp({
    deliveries: createDeliveries({
      createOrder: (_establishmentId, input) => {
        receivedInput = input;
        return Promise.resolve(deliveryOrder);
      },
    }),
  });
  const response = await app.inject({
    method: "POST",
    payload: {
      address: " Rua A, 1 ",
      customerName: " Cliente ",
      feeCents: 500,
      phone: " 11999999999 ",
    },
    url: "/delivery/orders",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedInput, {
    address: "Rua A, 1",
    customerName: "Cliente",
    feeCents: 500,
    phone: "11999999999",
  });
  assert.deepEqual(response.json(), { order: deliveryOrder });

  const invalidPhoneResponse = await app.inject({
    method: "POST",
    payload: {
      address: "Rua A, 1",
      customerName: "Cliente",
      feeCents: 500,
      phone: "22222222222222222222",
    },
    url: "/delivery/orders",
  });
  assert.equal(invalidPhoneResponse.statusCode, 400);
  assert.deepEqual(invalidPhoneResponse.json(), {
    status: "error",
    message: "Invalid delivery order",
  });
  await app.close();
});

void test("POST /delivery/orders/:orderId/status assigns the open courier day", async () => {
  let receivedDayId = "";
  let receivedStatus = "";
  const app = await createApp({
    deliveries: createDeliveries({
      advanceOrder: (_establishmentId, _orderId, status, dayId) => {
        receivedDayId = dayId ?? "";
        receivedStatus = status;
        return Promise.resolve({
          ...deliveryOrder,
          dayId,
          status,
        });
      },
    }),
  });
  const response = await app.inject({
    method: "POST",
    payload: { dayId: "day-id", status: "OUT_FOR_DELIVERY" },
    url: "/delivery/orders/delivery-order-id/status",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedDayId, "day-id");
  assert.equal(receivedStatus, "OUT_FOR_DELIVERY");
  await app.close();
});

void test("delivery routes require the delivery permissions", async () => {
  const app = await createApp({
    auth: createAuth({
      authenticate: () =>
        Promise.resolve({
          ...authenticatedUser,
          permissions: ["comandas.read"],
        }),
    }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/delivery/couriers",
  });

  assert.equal(response.statusCode, 403);

  await app.close();
});

void test("closing a delivery day is rejected when it is already closed", async () => {
  const app = await createApp({
    deliveries: createDeliveries({
      closeDay: () => Promise.reject(new DeliveryDayConflictError()),
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/delivery/days/day-id/close",
  });

  assert.equal(response.statusCode, 409);

  await app.close();
});
