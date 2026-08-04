import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildApp } from "../../src/app.js";
import { createPersistence, createPrismaClient } from "../../src/database.js";
import { provisionUser } from "../../src/user-provisioning.js";
import { resetOperationalData } from "../../src/operational-data-reset.js";
import { AuthCredentialsError } from "../../src/auth-repository.js";
import { provisionEstablishment } from "../../src/establishment-provisioning.js";
import {
  DEFAULT_MENU_CATEGORY_NAMES,
  LEGACY_SEED_PRODUCT_CODES,
  PORTUGAS_MENU,
} from "../../src/product-catalog.js";

const prisma = createPrismaClient();
const integrationUserName = "Integration Operator";
const integrationUserPassword = "integration-password";
const integrationEstablishmentName = "Integration Bistro";
const secondaryEstablishmentName = "Secondary Integration Bistro";
let integrationEstablishmentId = "";

before(async () => {
  await cleanupEstablishment(integrationEstablishmentName);
  await cleanupEstablishment(secondaryEstablishmentName);
  const establishment = await provisionEstablishment(prisma, {
    name: integrationEstablishmentName,
    ownerName: integrationUserName,
    ownerPassword: integrationUserPassword,
  });
  integrationEstablishmentId = establishment.id;
});

after(async () => {
  await cleanupEstablishment(secondaryEstablishmentName);
  await cleanupEstablishment(integrationEstablishmentName);
  await prisma.$disconnect();
});

async function cleanupEstablishment(name: string) {
  const establishment = await prisma.establishment.findUnique({
    select: { id: true },
    where: { normalizedName: name.toLocaleLowerCase("pt-BR") },
  });

  if (!establishment) {
    return;
  }

  const establishmentId = establishment.id;

  await prisma.$transaction(async (transaction) => {
    await transaction.restaurantTable.updateMany({
      data: { activeComandaId: null, status: "FREE" },
      where: { establishmentId },
    });
    await transaction.paymentAllocation.deleteMany({ where: { establishmentId } });
    await transaction.payment.deleteMany({
      where: { establishmentId },
    });
    await transaction.creditOrder.deleteMany({ where: { establishmentId } });
    await transaction.creditCustomer.deleteMany({
      where: { establishmentId },
    });
    await transaction.comandaItem.deleteMany({ where: { establishmentId } });
    await transaction.comandaEvent.deleteMany({ where: { establishmentId } });
    await transaction.comanda.deleteMany({ where: { establishmentId } });
    await transaction.inventoryMovement.deleteMany({
      where: { establishmentId },
    });
    await transaction.inventoryStock.deleteMany({
      where: { establishmentId },
    });
    await transaction.ingredient.deleteMany({ where: { establishmentId } });
    await transaction.auditLog.deleteMany({ where: { establishmentId } });
    await transaction.authSession.deleteMany({
      where: { user: { establishmentId } },
    });
    await transaction.userRole.deleteMany({
      where: { user: { establishmentId } },
    });
    await transaction.user.deleteMany({ where: { establishmentId } });
    await transaction.product.deleteMany({ where: { establishmentId } });
    await transaction.menuCategory.deleteMany({ where: { establishmentId } });
    await transaction.restaurantTable.deleteMany({
      where: { establishmentId },
    });
    await transaction.establishment.delete({ where: { id: establishmentId } });
  });
}

async function createAuthenticatedApp(
  name = integrationUserName,
  password = integrationUserPassword,
) {
  const persistence = createPersistence();
  const session = await persistence.auth.login(
    name,
    password,
  );
  const app = await buildApp(persistence);
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
        authorization: `Bearer ${session.token}`,
        ...request.headers,
      },
    });
  }) as typeof app.inject;

  return app;
}

void test("GET /ready connects to the configured MySQL database", async () => {
  const app = await createAuthenticatedApp();

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

void test("provisioned users authenticate with revocable opaque sessions", async () => {
  const persistence = createPersistence();
  const app = await buildApp(persistence);

  try {
    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        name: integrationUserName,
        password: integrationUserPassword,
      },
      url: "/auth/login",
    });
    assert.equal(loginResponse.statusCode, 200);
    const session = loginResponse.json<{
      session: {
        token: string;
        user: {
          id: string;
          permissions: string[];
          roles: { code: string }[];
        };
      };
    }>().session;
    assert.ok(session.token.length >= 20);
    assert.equal(session.user.roles.some(({ code }) => code === "OWNER"), true);
    assert.equal(
      session.user.permissions.includes("roles.manage"),
      true,
    );
    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.token}`,
      },
      method: "GET",
      url: "/auth/me",
    });
    assert.equal(meResponse.statusCode, 200);
    assert.equal(
      meResponse.json<{ user: { id: string } }>().user.id,
      session.user.id,
    );

    const logoutResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.token}`,
      },
      method: "POST",
      url: "/auth/logout",
    });
    assert.equal(logoutResponse.statusCode, 204);
    assert.equal(await persistence.auth.authenticate(session.token), null);
    await assert.rejects(
      persistence.auth.login(integrationUserName, "incorrect-password"),
      AuthCredentialsError,
    );

    const expiringSession = await persistence.auth.login(
      integrationUserName,
      integrationUserPassword,
    );
    const persistedSession = await prisma.authSession.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { userId: expiringSession.user.id },
    });
    await prisma.authSession.update({
      data: { expiresAt: new Date(0) },
      where: { id: persistedSession.id },
    });
    assert.equal(
      await persistence.auth.authenticate(expiringSession.token),
      null,
    );

    await prisma.user.update({
      data: { active: false },
      where: { id: expiringSession.user.id },
    });
    await assert.rejects(
      persistence.auth.login(integrationUserName, integrationUserPassword),
      AuthCredentialsError,
    );
    await prisma.user.update({
      data: { active: true },
      where: { id: expiringSession.user.id },
    });
  } finally {
    await app.close();
  }
});

void test("comanda lifecycle is persisted and audited", async () => {
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 1 },
  });
  const operator = await prisma.user.findUniqueOrThrow({
    where: { normalizedName: integrationUserName.toLocaleLowerCase("pt-BR") },
  });
  const app = await createAuthenticatedApp();

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
    assert.equal(openedEvent.actorUserId, operator.id);

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
    assert.equal(cancelledEvent.actorUserId, operator.id);

    const auditActions = await prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
      select: { action: true, userId: true },
      where: {
        resourceId: openedComanda.id,
        resourceType: "COMANDA",
      },
    });
    assert.deepEqual(
      auditActions.map(({ action }) => action),
      ["COMANDA_OPENED", "COMANDA_CANCELLED"],
    );
    assert.equal(
      auditActions.every(({ userId }) => userId === operator.id),
      true,
    );

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
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 2 },
  });
  const app = await createAuthenticatedApp();

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
      establishmentId: integrationEstablishmentId,
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
        establishmentId: integrationEstablishmentId,
      },
    }),
    0,
  );

  const app = await createAuthenticatedApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/products",
    });

    assert.equal(response.statusCode, 200);
    const catalog = response.json<{
      products: {
        category: { id: string; name: string };
        description: string | null;
        id: string;
        name: string;
        priceCents: number;
      }[];
    }>().products;
    const catalogByName = new Map(catalog.map((product) => [product.name, product]));

    assert.equal(catalog.length, activeMenu.length);
    assert.equal(catalogByName.size, activeMenu.length);

    for (const product of activeMenu) {
      assert.equal(
        catalogByName.get(product.name)?.category.name,
        DEFAULT_MENU_CATEGORY_NAMES[product.category],
      );
      assert.equal(catalogByName.get(product.name)?.priceCents, product.priceCents);
    }

    assert.equal(
      catalog.some(({ category }) => category.name === "Adicionais"),
      false,
    );
  } finally {
    await app.close();
  }
});

void test("administrators manage an audited tenant menu", async () => {
  const app = await createAuthenticatedApp();

  try {
    const categoryResponse = await app.inject({
      method: "POST",
      payload: { name: "Sobremesas de integracao" },
      url: "/admin/categories",
    });
    assert.equal(categoryResponse.statusCode, 201);
    const category = categoryResponse.json<{
      category: { id: string };
    }>().category;

    const productResponse = await app.inject({
      method: "POST",
      payload: {
        categoryId: category.id,
        description: "Fatia",
        name: "Torta de integracao",
        priceCents: 1250,
      },
      url: "/admin/products",
    });
    assert.equal(productResponse.statusCode, 201);
    const product = productResponse.json<{
      product: { id: string };
    }>().product;

    const publicCatalog = await app.inject({ method: "GET", url: "/products" });
    assert.equal(
      publicCatalog
        .json<{ products: { id: string }[] }>()
        .products.some(({ id }) => id === product.id),
      true,
    );

    const deletion = await app.inject({
      method: "DELETE",
      url: `/admin/categories/${category.id}`,
    });
    assert.equal(deletion.statusCode, 200);
    assert.equal(
      await prisma.product.count({
        where: { active: true, establishmentId: integrationEstablishmentId, id: product.id },
      }),
      0,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: { in: ["MENU_CATEGORY_CREATED", "MENU_PRODUCT_CREATED", "MENU_CATEGORY_DEACTIVATED"] },
          establishmentId: integrationEstablishmentId,
          resourceId: { in: [category.id, product.id] },
        },
      }),
      3,
    );
  } finally {
    await app.close();
  }
});

void test("comanda items are consolidated, totaled and audited", async () => {
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 3 },
  });
  const hamburger = await prisma.product.findFirstOrThrow({
    where: {
      code: "CLASSIC_HAMBURGER",
      establishmentId: integrationEstablishmentId,
    },
  });
  const app = await createAuthenticatedApp();

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
          createdAt: string;
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
      createdAt: firstItem.createdAt,
      id: firstItem.id,
      productId: hamburger.id,
      productName: "Hambúrguer",
      quantity: 1,
      subtotalCents: 1_099,
      unitPriceCents: 1_099,
    });
    assert.ok(firstItem.createdAt);

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
      payload: {
        payments: [{ amountCents: 1_099, method: "PIX" }],
      },
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
      payload: {
        payments: [{ amountCents: 1_099, method: "PIX" }],
      },
      url: `/comandas/${openedComanda.id}/close`,
    });
    assert.equal(secondCloseResponse.statusCode, 409);
  } finally {
    await app.close();
  }
});

void test("manual credit orders are resumed, finalized, grouped and settled", async () => {
  const hamburger = await prisma.product.findFirstOrThrow({
    where: {
      code: "CLASSIC_HAMBURGER",
      establishmentId: integrationEstablishmentId,
    },
  });
  const app = await createAuthenticatedApp();

  try {
    const customerResponse = await app.inject({
      method: "POST",
      payload: {
        name: "  Maria   José  ",
      },
      url: "/credit-customers",
    });
    const customer = customerResponse.json<{
      customer: { id: string; name: string };
    }>().customer;

    assert.equal(customerResponse.statusCode, 201);
    assert.equal(customer.name, "Maria José");

    const duplicateCustomerResponse = await app.inject({
      method: "POST",
      payload: {
        name: "maria josé",
      },
      url: "/credit-customers",
    });
    assert.equal(
      duplicateCustomerResponse.json<{ customer: { id: string } }>().customer.id,
      customer.id,
    );

    const draftResponse = await app.inject({
      method: "POST",
      url: `/credit-customers/${customer.id}/orders`,
    });
    const draftOrder = draftResponse.json<{
      order: { comandaId: string; id: string; status: string };
    }>().order;

    assert.equal(draftResponse.statusCode, 201);
    assert.equal(draftOrder.status, "DRAFT");

    const draftComandaResponse = await app.inject({
      method: "GET",
      url: `/comandas/${draftOrder.comandaId}`,
    });
    const draftComanda = draftComandaResponse.json<{
      comanda: {
        credit: { customerId: string; orderId: string; status: string };
        table: null;
      };
    }>().comanda;
    assert.equal(draftComanda.table, null);
    assert.deepEqual(draftComanda.credit, {
      balanceCents: 0,
      customerId: customer.id,
      customerName: "Maria José",
      orderId: draftOrder.id,
      paidCents: 0,
      source: "MANUAL",
      status: "DRAFT",
      totalCents: 0,
    });

    const emptyFinalizeResponse = await app.inject({
      method: "POST",
      url: `/credit-orders/${draftOrder.id}/finalize`,
    });
    assert.equal(emptyFinalizeResponse.statusCode, 409);

    const addResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${draftOrder.comandaId}/items`,
    });
    const addedItem = addResponse.json<{
      comanda: { items: { createdAt: string; id: string }[] };
    }>().comanda.items[0];
    const itemId = addedItem.id;
    assert.equal(addResponse.statusCode, 200);
    assert.ok(addedItem.createdAt);

    const pendingFinalizeResponse = await app.inject({
      method: "POST",
      url: `/credit-orders/${draftOrder.id}/finalize`,
    });
    assert.equal(pendingFinalizeResponse.statusCode, 409);

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/comandas/${draftOrder.comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(confirmResponse.statusCode, 200);

    const finalizeResponse = await app.inject({
      method: "POST",
      url: `/credit-orders/${draftOrder.id}/finalize`,
    });
    const finalizedOrder = finalizeResponse.json<{
      order: { finalizedAt: string | null; status: string; totalCents: number };
    }>().order;
    assert.equal(finalizeResponse.statusCode, 200);
    assert.equal(finalizedOrder.status, "OPEN");
    assert.equal(finalizedOrder.totalCents, 1_099);
    assert.ok(finalizedOrder.finalizedAt);

    const secondDraftResponse = await app.inject({
      method: "POST",
      url: `/credit-customers/${customer.id}/orders`,
    });
    const secondDraft = secondDraftResponse.json<{
      order: { comandaId: string; id: string };
    }>().order;
    const cancelResponse = await app.inject({
      method: "POST",
      url: `/credit-orders/${secondDraft.id}/cancel`,
    });
    assert.equal(cancelResponse.statusCode, 200);
    assert.equal(
      cancelResponse.json<{ order: { status: string } }>().order.status,
      "CANCELLED",
    );

    const cancelledComanda = await prisma.comanda.findUniqueOrThrow({
      where: { id: secondDraft.comandaId },
    });
    assert.equal(cancelledComanda.status, "CANCELLED");

    const thirdDraftResponse = await app.inject({
      method: "POST",
      url: `/credit-customers/${customer.id}/orders`,
    });
    const thirdDraft = thirdDraftResponse.json<{
      order: { comandaId: string; id: string };
    }>().order;
    const thirdAddResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${thirdDraft.comandaId}/items`,
    });
    const thirdItemId = thirdAddResponse.json<{
      comanda: { items: { id: string }[] };
    }>().comanda.items[0].id;
    await app.inject({
      method: "POST",
      url: `/comandas/${thirdDraft.comandaId}/items/${thirdItemId}/confirm`,
    });
    const thirdFinalizeResponse = await app.inject({
      method: "POST",
      url: `/credit-orders/${thirdDraft.id}/finalize`,
    });
    assert.equal(thirdFinalizeResponse.statusCode, 200);

    const listResponse = await app.inject({
      method: "GET",
      url: "/credit-customers",
    });
    assert.deepEqual(listResponse.json(), {
      customers: [
        {
          balanceCents: 2_198,
          draftOrderCount: 0,
          id: customer.id,
          name: "Maria José",
          openOrderCount: 2,
        },
      ],
    });

    const settlementResponse = await app.inject({
      method: "POST",
      payload: {
        payments: [{ amountCents: 1_099, method: "CASH" }],
      },
      url: `/credit-orders/${draftOrder.id}/settle`,
    });
    const settlement = settlementResponse.json<{
      payment: {
        amountCents: number;
        id: string;
        paidAt: string;
      };
      order: { balanceCents: number; id: string; status: string };
    }>();
    assert.equal(settlementResponse.statusCode, 200);
    assert.equal(settlement.payment.amountCents, 1_099);
    assert.equal(settlement.order.id, draftOrder.id);
    assert.equal(settlement.order.balanceCents, 0);
    assert.equal(settlement.order.status, "SETTLED");
    assert.ok(settlement.payment.paidAt);

    const secondSettlementResponse = await app.inject({
      method: "POST",
      payload: {
        payments: [{ amountCents: 1_099, method: "CASH" }],
      },
      url: `/credit-orders/${draftOrder.id}/settle`,
    });
    assert.equal(secondSettlementResponse.statusCode, 409);

    const remainingListResponse = await app.inject({
      method: "GET",
      url: "/credit-customers",
    });
    assert.deepEqual(remainingListResponse.json(), {
      customers: [
        {
          balanceCents: 1_099,
          draftOrderCount: 0,
          id: customer.id,
          name: "Maria José",
          openOrderCount: 1,
        },
      ],
    });

    const detailsResponse = await app.inject({
      method: "GET",
      url: `/credit-customers/${customer.id}`,
    });
    const details = detailsResponse.json<{
      customer: {
        orders: {
          id: string;
          payments: { amountCents: number; paidAt: string }[];
          status: string;
          totalCents: number;
        }[];
      };
    }>().customer;
    assert.deepEqual(
      details.orders
        .map(({ status, totalCents }) => ({ status, totalCents }))
        .sort((left, right) => left.status.localeCompare(right.status)),
      [
        { status: "CANCELLED", totalCents: 0 },
        { status: "OPEN", totalCents: 1_099 },
        { status: "SETTLED", totalCents: 1_099 },
      ],
    );
    const settledDetails = details.orders.find(({ id }) => id === draftOrder.id);
    assert.equal(settledDetails?.payments[0].amountCents, 1_099);
    assert.ok(settledDetails?.payments[0].paidAt);
  } finally {
    await app.close();
  }
});

void test("table credit conversion is atomic and releases only confirmed orders", async () => {
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 4 },
  });
  const hamburger = await prisma.product.findFirstOrThrow({
    where: {
      code: "CLASSIC_HAMBURGER",
      establishmentId: integrationEstablishmentId,
    },
  });
  const app = await createAuthenticatedApp();

  try {
    const customerResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Cliente da mesa",
      },
      url: "/credit-customers",
    });
    const customerId = customerResponse.json<{
      customer: { id: string };
    }>().customer.id;
    const openResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Cliente da mesa",
      },
      url: `/tables/${table.id}/comandas`,
    });
    const comandaId = openResponse.json<{
      comanda: { id: string };
    }>().comanda.id;
    const addResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${comandaId}/items`,
    });
    const itemId = addResponse.json<{
      comanda: { items: { id: string }[] };
    }>().comanda.items[0].id;

    const pendingConversion = await app.inject({
      method: "POST",
      payload: {
        customerId,
      },
      url: `/comandas/${comandaId}/credit`,
    });
    assert.equal(pendingConversion.statusCode, 409);
    assert.equal(
      (await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
      "OPEN",
    );

    await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    const conversionResponse = await app.inject({
      method: "POST",
      payload: {
        customerId,
      },
      url: `/comandas/${comandaId}/credit`,
    });
    const order = conversionResponse.json<{
      order: {
        id: string;
        orderedAt: string;
        source: string;
        status: string;
        tableNumber: number | null;
        totalCents: number;
      };
    }>().order;

    assert.equal(conversionResponse.statusCode, 200);
    assert.equal(order.source, "TABLE");
    assert.equal(order.status, "OPEN");
    assert.equal(order.tableNumber, 4);
    assert.equal(order.totalCents, 1_099);
    assert.ok(order.orderedAt);

    const releasedTable = await prisma.restaurantTable.findUniqueOrThrow({
      where: { id: table.id },
    });
    assert.equal(releasedTable.activeComandaId, null);
    assert.equal(releasedTable.status, "FREE");
    assert.equal(
      (await prisma.comanda.findUniqueOrThrow({ where: { id: comandaId } })).status,
      "OPEN",
    );

    const editOpenOrderResponse = await app.inject({
      method: "POST",
      payload: {
        productId: hamburger.id,
      },
      url: `/comandas/${comandaId}/items`,
    });
    assert.equal(editOpenOrderResponse.statusCode, 200);

    const pendingDetailsResponse = await app.inject({
      method: "GET",
      url: `/credit-customers/${customerId}`,
    });
    const pendingOrder = pendingDetailsResponse
      .json<{
        customer: {
          orders: {
            hasPendingItems: boolean;
            id: string;
            totalCents: number;
          }[];
        };
      }>()
      .customer.orders.find(({ id }) => id === order.id);
    assert.equal(pendingOrder?.hasPendingItems, true);
    assert.equal(pendingOrder?.totalCents, 2_198);

    const confirmOpenEditResponse = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(confirmOpenEditResponse.statusCode, 200);

    const editedDetailsResponse = await app.inject({
      method: "GET",
      url: `/credit-customers/${customerId}`,
    });
    const editedOrder = editedDetailsResponse
      .json<{
        customer: {
          orders: {
            hasPendingItems: boolean;
            id: string;
            totalCents: number;
          }[];
        };
      }>()
      .customer.orders.find(({ id }) => id === order.id);
    assert.equal(editedOrder?.hasPendingItems, false);
    assert.equal(editedOrder?.totalCents, 2_198);

    const secondConversion = await app.inject({
      method: "POST",
      payload: {
        customerId,
      },
      url: `/comandas/${comandaId}/credit`,
    });
    assert.equal(secondConversion.statusCode, 409);
  } finally {
    await app.close();
  }
});

void test("mixed checkout supports installments, later additions and concurrent final payment", async () => {
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 3 },
  });
  const allCreditTable = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 5 },
  });
  const hamburger = await prisma.product.findFirstOrThrow({
    where: {
      code: "CLASSIC_HAMBURGER",
      establishmentId: integrationEstablishmentId,
    },
  });
  const app = await createAuthenticatedApp();

  try {
    const customerResponse = await app.inject({
      method: "POST",
      payload: { name: "Cliente pagamento misto" },
      url: "/credit-customers",
    });
    const customerId = customerResponse.json<{
      customer: { id: string };
    }>().customer.id;

    const openAndConfirm = async (tableId: number) => {
      const openResponse = await app.inject({
        method: "POST",
        payload: { name: "Pagamento misto" },
        url: `/tables/${tableId}/comandas`,
      });
      const opened = openResponse.json<{
        comanda: { id: string };
      }>().comanda;
      const addResponse = await app.inject({
        method: "POST",
        payload: { productId: hamburger.id },
        url: `/comandas/${opened.id}/items`,
      });
      const itemId = addResponse.json<{
        comanda: { items: { id: string }[] };
      }>().comanda.items[0].id;
      await app.inject({
        method: "POST",
        url: `/comandas/${opened.id}/items/${itemId}/confirm`,
      });
      return { comandaId: opened.id, itemId };
    };

    const mixed = await openAndConfirm(table.id);
    const overpayment = await app.inject({
      method: "POST",
      payload: { payments: [{ amountCents: 1_100, method: "PIX" }] },
      url: `/comandas/${mixed.comandaId}/close`,
    });
    assert.equal(overpayment.statusCode, 409);
    assert.equal(
      await prisma.payment.count({ where: { comandaId: mixed.comandaId } }),
      0,
    );

    const missingCustomer = await app.inject({
      method: "POST",
      payload: { payments: [{ amountCents: 500, method: "PIX" }] },
      url: `/comandas/${mixed.comandaId}/close`,
    });
    assert.equal(missingCustomer.statusCode, 409);

    const checkout = await app.inject({
      method: "POST",
      payload: {
        customerId,
        payments: [
          { amountCents: 100, method: "CASH" },
          { amountCents: 200, method: "CASH" },
          { amountCents: 200, method: "PIX" },
        ],
      },
      url: `/comandas/${mixed.comandaId}/close`,
    });
    const checkedOut = checkout.json<{
      comanda: {
        credit: {
          balanceCents: number;
          orderId: string;
          paidCents: number;
          totalCents: number;
        };
        payments: {
          allocations: { amountCents: number; id: string; method: string }[];
          amountCents: number;
          comandaId: string;
        }[];
        status: string;
      };
    }>().comanda;
    assert.equal(checkout.statusCode, 200);
    assert.equal(checkedOut.status, "OPEN");
    assert.deepEqual(checkedOut.credit, {
      balanceCents: 599,
      customerId,
      customerName: "Cliente pagamento misto",
      orderId: checkedOut.credit.orderId,
      paidCents: 500,
      source: "TABLE",
      status: "OPEN",
      totalCents: 1_099,
    });
    assert.equal(checkedOut.payments[0].amountCents, 500);
    assert.equal(checkedOut.payments[0].comandaId, mixed.comandaId);
    assert.deepEqual(checkedOut.payments[0].allocations, [
      { amountCents: 300, id: checkedOut.payments[0].allocations[0].id, method: "CASH" },
      { amountCents: 200, id: checkedOut.payments[0].allocations[1].id, method: "PIX" },
    ]);
    assert.equal(
      (await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
      "FREE",
    );

    const firstInstallment = await app.inject({
      method: "POST",
      payload: { payments: [{ amountCents: 200, method: "DEBIT_CARD" }] },
      url: `/credit-orders/${checkedOut.credit.orderId}/settle`,
    });
    assert.equal(firstInstallment.statusCode, 200);
    assert.equal(
      firstInstallment.json<{ order: { balanceCents: number; status: string } }>()
        .order.balanceCents,
      399,
    );

    const addAfterPayment = await app.inject({
      method: "POST",
      payload: { productId: hamburger.id },
      url: `/comandas/${mixed.comandaId}/items`,
    });
    assert.equal(addAfterPayment.statusCode, 200);
    await app.inject({
      method: "POST",
      url: `/comandas/${mixed.comandaId}/items/${mixed.itemId}/confirm`,
    });

    const secondInstallment = await app.inject({
      method: "POST",
      payload: { payments: [{ amountCents: 500, method: "CREDIT_CARD" }] },
      url: `/credit-orders/${checkedOut.credit.orderId}/settle`,
    });
    const afterSecond = secondInstallment.json<{
      order: { balanceCents: number; paidCents: number; totalCents: number };
    }>().order;
    assert.deepEqual(afterSecond, {
      ...afterSecond,
      balanceCents: 998,
      paidCents: 1_200,
      totalCents: 2_198,
    });

    const concurrentFinalPayments = await Promise.all([
      app.inject({
        method: "POST",
        payload: { payments: [{ amountCents: 998, method: "PIX" }] },
        url: `/credit-orders/${checkedOut.credit.orderId}/settle`,
      }),
      app.inject({
        method: "POST",
        payload: { payments: [{ amountCents: 998, method: "PIX" }] },
        url: `/credit-orders/${checkedOut.credit.orderId}/settle`,
      }),
    ]);
    assert.deepEqual(
      concurrentFinalPayments.map(({ statusCode }) => statusCode).sort(),
      [200, 409],
    );

    const allCredit = await openAndConfirm(allCreditTable.id);
    const allCreditCheckout = await app.inject({
      method: "POST",
      payload: { customerId, payments: [] },
      url: `/comandas/${allCredit.comandaId}/close`,
    });
    const allCreditOrderId = allCreditCheckout.json<{
      comanda: { credit: { orderId: string } };
    }>().comanda.credit.orderId;
    assert.equal(allCreditCheckout.statusCode, 200);

    const detailsResponse = await app.inject({
      method: "GET",
      url: `/credit-customers/${customerId}`,
    });
    const orders = detailsResponse.json<{
      customer: {
        orders: {
          balanceCents: number;
          id: string;
          paidCents: number;
          payments: { amountCents: number }[];
          status: string;
          totalCents: number;
        }[];
      };
    }>().customer.orders;
    const settled = orders.find(({ id }) => id === checkedOut.credit.orderId);
    const untouched = orders.find(({ id }) => id === allCreditOrderId);
    assert.deepEqual(
      {
        balanceCents: settled?.balanceCents,
        paidCents: settled?.paidCents,
        paymentAmounts: settled?.payments.map(({ amountCents }) => amountCents),
        status: settled?.status,
        totalCents: settled?.totalCents,
      },
      {
        balanceCents: 0,
        paidCents: 2_198,
        paymentAmounts: [500, 200, 500, 998],
        status: "SETTLED",
        totalCents: 2_198,
      },
    );
    assert.deepEqual(
      {
        balanceCents: untouched?.balanceCents,
        paidCents: untouched?.paidCents,
        payments: untouched?.payments,
        status: untouched?.status,
      },
      { balanceCents: 1_099, paidCents: 0, payments: [], status: "OPEN" },
    );

    const auditActions = await prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
      select: { action: true },
      where: {
        establishmentId: integrationEstablishmentId,
        resourceId: checkedOut.credit.orderId,
      },
    });
    assert.deepEqual(
      auditActions.map(({ action }) => action),
      [
        "COMANDA_CONVERTED_TO_CREDIT",
        "CREDIT_PAYMENT_RECORDED",
        "CREDIT_PAYMENT_RECORDED",
        "CREDIT_ORDER_SETTLED",
      ],
    );
  } finally {
    await app.close();
  }
});

void test("statements aggregate dated sales, credit additions and settlements", async () => {
  const statementCategory = await prisma.menuCategory.findFirstOrThrow({
    where: {
      establishmentId: integrationEstablishmentId,
      normalizedName: "outros",
    },
  });
  const product = await prisma.product.upsert({
    create: {
      categoryId: statementCategory.id,
      code: "STATEMENT_TEST_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Produto de extrato",
      priceCents: 500,
    },
    update: {
      active: true,
      name: "Produto de extrato",
      priceCents: 500,
    },
    where: {
      establishmentId_code: {
        code: "STATEMENT_TEST_PRODUCT",
        establishmentId: integrationEstablishmentId,
      },
    },
  });
  const tableComanda = await prisma.comanda.create({
    data: {
      closedAt: new Date("2031-04-10T12:00:00.000Z"),
      establishmentId: integrationEstablishmentId,
      items: {
        create: {
          confirmedQuantity: 2,
          productId: product.id,
          productName: product.name,
          quantity: 2,
          unitPriceCents: 1_000,
        },
      },
      name: "Mesa extrato",
      status: "CLOSED",
    },
  });
  const customer = await prisma.creditCustomer.create({
    data: {
      establishmentId: integrationEstablishmentId,
      name: "Cliente extrato",
      normalizedName: `cliente extrato ${Date.now()}`,
    },
  });
  const creditComanda = await prisma.comanda.create({
    data: {
      closedAt: new Date("2031-04-12T15:00:00.000Z"),
      establishmentId: integrationEstablishmentId,
      events: {
        create: [
          {
            createdAt: new Date("2031-04-10T12:30:00.000Z"),
            newQuantity: 1,
            previousQuantity: 0,
            productId: product.id,
            productName: product.name,
            type: "ITEM_CONFIRMED",
            unitPriceCents: 500,
          },
          {
            createdAt: new Date("2031-04-11T14:00:00.000Z"),
            newQuantity: 3,
            previousQuantity: 1,
            productId: product.id,
            productName: product.name,
            type: "ITEM_CONFIRMED",
            unitPriceCents: 500,
          },
        ],
      },
      items: {
        create: {
          confirmedQuantity: 3,
          productId: product.id,
          productName: product.name,
          quantity: 3,
          unitPriceCents: 500,
        },
      },
      name: customer.name,
      status: "CLOSED",
    },
  });
  const settledOrder = await prisma.creditOrder.create({
    data: {
      comandaId: creditComanda.id,
      customerId: customer.id,
      establishmentId: integrationEstablishmentId,
      finalizedAt: new Date("2031-04-10T13:00:00.000Z"),
      orderedAt: new Date("2031-04-10T11:00:00.000Z"),
      settledAt: new Date("2031-04-12T15:00:00.000Z"),
      source: "TABLE",
      status: "SETTLED",
      totalCents: 1_500,
    },
  });
  const cancelledComanda = await prisma.comanda.create({
    data: {
      cancellationReason: "OPENED_BY_MISTAKE",
      cancelledAt: new Date("2031-04-11T16:00:00.000Z"),
      establishmentId: integrationEstablishmentId,
      items: {
        create: {
          confirmedQuantity: 0,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPriceCents: 500,
        },
      },
      name: "Cancelada extrato",
      status: "CANCELLED",
    },
  });
  const checkoutPayment = await prisma.payment.create({
    data: {
      amountCents: 200,
      comandaId: creditComanda.id,
      creditOrderId: settledOrder.id,
      establishmentId: integrationEstablishmentId,
      origin: "TABLE_CHECKOUT",
      paidAt: new Date("2031-04-10T13:00:00.000Z"),
    },
  });
  const statementPayment = await prisma.payment.create({
    data: {
      amountCents: 1_300,
      comandaId: creditComanda.id,
      creditOrderId: settledOrder.id,
      establishmentId: integrationEstablishmentId,
      origin: "CREDIT_INSTALLMENT",
      paidAt: new Date("2031-04-12T15:00:00.000Z"),
    },
  });
  await prisma.paymentAllocation.createMany({
    data: [
      {
        amountCents: 200,
        establishmentId: integrationEstablishmentId,
        method: "CASH",
        paymentId: checkoutPayment.id,
      },
      {
        amountCents: 300,
        establishmentId: integrationEstablishmentId,
        method: "CASH",
        paymentId: statementPayment.id,
      },
      {
        amountCents: 1_000,
        establishmentId: integrationEstablishmentId,
        method: "PIX",
        paymentId: statementPayment.id,
      },
    ],
  });
  await prisma.product.update({
    data: {
      name: "Produto alterado depois",
      priceCents: 900,
    },
    where: { id: product.id },
  });
  const app = await createAuthenticatedApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/statements?from=2031-04-10&to=2031-04-12",
    });

    assert.equal(response.statusCode, 200);
    const report = response.json<{
      statement: {
        days: Array<{ date: string; soldCents: number }>;
        entries: Array<{
          comandaId: string;
          creditBalanceAfterCents: number | null;
          creditPaidAfterCents: number | null;
          creditPaidBeforeCents: number | null;
          creditTotalCents: number | null;
          customerName: string | null;
          event: string;
          items: Array<{
            productName: string;
            quantity: number;
            unitPriceCents: number;
          }>;
          paymentOrigin: string | null;
          tableCheckoutPaidCents: number | null;
        }>;
        indicators: {
          averageTicketCents: number;
          differenceCents: number;
          paymentMethodSummaries: Array<{
            method: string;
            receivedCents: number;
          }>;
          saleCommandCount: number;
        };
        summary: {
          cancelledCommandCount: number;
          closedCommandCount: number;
          processedCommandCount: number;
          receivedCents: number;
          receivedItemCount: number;
          soldCents: number;
          soldItemCount: number;
        };
      };
    }>().statement;

    assert.deepEqual(report.summary, {
      cancelledCommandCount: 1,
      closedCommandCount: 2,
      processedCommandCount: 3,
      receivedCents: 3_500,
      receivedItemCount: 2,
      soldCents: 3_500,
      soldItemCount: 5,
    });
    assert.deepEqual(
      report.days.map((day) => [day.date, day.soldCents]),
      [
        ["2031-04-10", 2_500],
        ["2031-04-11", 1_000],
        ["2031-04-12", 0],
      ],
    );
    assert.deepEqual(
      report.entries.map((entry) => entry.event),
      [
        "TABLE_CLOSED",
        "CREDIT_FINALIZED",
        "CREDIT_PAYMENT",
        "CREDIT_ADDITION",
        "COMANDA_CANCELLED",
        "CREDIT_SETTLED",
      ],
    );
    assert.equal(report.indicators.averageTicketCents, 1_750);
    assert.equal(report.indicators.differenceCents, 0);
    assert.equal(report.indicators.saleCommandCount, 2);
    assert.deepEqual(
      report.entries
        .filter((entry) => entry.comandaId === creditComanda.id)
        .map((entry) => ({
          balance: entry.creditBalanceAfterCents,
          event: entry.event,
          paidAfter: entry.creditPaidAfterCents,
          paidBefore: entry.creditPaidBeforeCents,
          paymentOrigin: entry.paymentOrigin,
          tableCheckoutPaid: entry.tableCheckoutPaidCents,
          total: entry.creditTotalCents,
        })),
      [
        { balance: 300, event: "CREDIT_FINALIZED", paidAfter: 200, paidBefore: 0, paymentOrigin: null, tableCheckoutPaid: 200, total: 500 },
        { balance: 300, event: "CREDIT_PAYMENT", paidAfter: 200, paidBefore: 0, paymentOrigin: "TABLE_CHECKOUT", tableCheckoutPaid: 200, total: 500 },
        { balance: 1_300, event: "CREDIT_ADDITION", paidAfter: 200, paidBefore: 200, paymentOrigin: null, tableCheckoutPaid: 200, total: 1_500 },
        { balance: 0, event: "CREDIT_SETTLED", paidAfter: 1_500, paidBefore: 200, paymentOrigin: "CREDIT_INSTALLMENT", tableCheckoutPaid: 200, total: 1_500 },
      ],
    );
    assert.deepEqual(report.indicators.paymentMethodSummaries, [
      { method: "CASH", receivedCents: 500 },
      { method: "PIX", receivedCents: 1_000 },
      { method: "DEBIT_CARD", receivedCents: 0 },
      { method: "CREDIT_CARD", receivedCents: 0 },
      { method: "UNSPECIFIED", receivedCents: 2_000 },
    ]);
    assert.equal(
      report.indicators.paymentMethodSummaries.reduce(
        (total, payment) => total + payment.receivedCents,
        0,
      ),
      report.summary.receivedCents,
    );
    assert.deepEqual(
      report.entries.map((entry) => ({
        customerName: entry.customerName,
        event: entry.event,
        items: entry.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      })),
      [
        { customerName: null, event: "TABLE_CLOSED", items: [{ productName: "Produto de extrato", quantity: 2, unitPriceCents: 1_000 }] },
        { customerName: "Cliente extrato", event: "CREDIT_FINALIZED", items: [{ productName: "Produto de extrato", quantity: 1, unitPriceCents: 500 }] },
        { customerName: "Cliente extrato", event: "CREDIT_PAYMENT", items: [] },
        { customerName: "Cliente extrato", event: "CREDIT_ADDITION", items: [{ productName: "Produto de extrato", quantity: 2, unitPriceCents: 500 }] },
        { customerName: null, event: "COMANDA_CANCELLED", items: [{ productName: "Produto de extrato", quantity: 1, unitPriceCents: 500 }] },
        { customerName: "Cliente extrato", event: "CREDIT_SETTLED", items: [] },
      ],
    );

    const pdfResponse = await app.inject({
      method: "GET",
      url: "/statements/export.pdf?from=2031-04-10&to=2031-04-12&view=summary",
    });
    assert.equal(pdfResponse.statusCode, 200);
    assert.equal(pdfResponse.rawPayload.subarray(0, 4).toString(), "%PDF");

    const filteredPdfResponse = await app.inject({
      method: "GET",
      url: "/statements/export.pdf?from=2031-04-10&to=2031-04-12&view=detailed&movementType=RECEIPTS&origin=CREDIT_TABLE",
    });
    assert.equal(filteredPdfResponse.statusCode, 200);
    assert.equal(filteredPdfResponse.rawPayload.subarray(0, 4).toString(), "%PDF");
  } finally {
    await app.close();
    await prisma.paymentAllocation.deleteMany({
      where: {
        paymentId: { in: [checkoutPayment.id, statementPayment.id] },
      },
    });
    await prisma.payment.deleteMany({
      where: {
        comandaId: creditComanda.id,
      },
    });
    await prisma.creditOrder.deleteMany({
      where: {
        comandaId: creditComanda.id,
      },
    });
    await prisma.comandaItem.deleteMany({
      where: {
        comandaId: {
          in: [tableComanda.id, creditComanda.id, cancelledComanda.id],
        },
      },
    });
    await prisma.comandaEvent.deleteMany({
      where: {
        comandaId: creditComanda.id,
      },
    });
    await prisma.comanda.deleteMany({
      where: {
        id: {
          in: [tableComanda.id, creditComanda.id, cancelledComanda.id],
        },
      },
    });
    await prisma.creditCustomer.delete({
      where: {
        id: customer.id,
      },
    });
    await prisma.product.delete({
      where: {
        id: product.id,
      },
    });
  }
});

void test("establishments isolate data and support multiple owners and employees", async () => {
  const secondaryOwnerName = "Secondary Owner";
  const secondaryOwnerPassword = "secondary-owner-password";
  const secondary = await provisionEstablishment(prisma, {
    name: secondaryEstablishmentName,
    ownerName: secondaryOwnerName,
    ownerPassword: secondaryOwnerPassword,
  });
  const secondOwner = await provisionUser(prisma, {
    establishmentName: secondaryEstablishmentName,
    name: "Secondary Co-owner",
    password: "secondary-co-owner-password",
    roleCodes: ["OWNER"],
  });
  const employee = await provisionUser(prisma, {
    establishmentName: secondaryEstablishmentName,
    name: "Secondary Waiter",
    password: "secondary-waiter-password",
    roleCodes: ["WAITER"],
  });

  assert.equal(secondOwner.establishment.id, secondary.id);
  assert.equal(employee.establishment.id, secondary.id);

  const primaryApp = await createAuthenticatedApp();
  const secondaryApp = await createAuthenticatedApp(
    secondaryOwnerName,
    secondaryOwnerPassword,
  );

  try {
    const [primaryTablesResponse, secondaryTablesResponse] = await Promise.all([
      primaryApp.inject({ method: "GET", url: "/tables" }),
      secondaryApp.inject({ method: "GET", url: "/tables" }),
    ]);
    const primaryTables = primaryTablesResponse.json<{
      tables: { id: number; number: number }[];
    }>().tables;
    const secondaryTables = secondaryTablesResponse.json<{
      tables: { id: number; number: number }[];
    }>().tables;

    assert.equal(primaryTables.length, 12);
    assert.equal(secondaryTables.length, 12);
    assert.equal(primaryTables[0]?.number, 1);
    assert.equal(secondaryTables[0]?.number, 1);
    assert.notEqual(primaryTables[0]?.id, secondaryTables[0]?.id);

    const primaryCustomerResponse = await primaryApp.inject({
      method: "POST",
      payload: { name: "Cliente compartilhado" },
      url: "/credit-customers",
    });
    const secondaryCustomerResponse = await secondaryApp.inject({
      method: "POST",
      payload: { name: "Cliente compartilhado" },
      url: "/credit-customers",
    });
    const primaryCustomerId = primaryCustomerResponse.json<{
      customer: { id: string };
    }>().customer.id;
    const secondaryCustomerId = secondaryCustomerResponse.json<{
      customer: { id: string };
    }>().customer.id;

    assert.notEqual(primaryCustomerId, secondaryCustomerId);
    const crossTenantResponse = await secondaryApp.inject({
      method: "GET",
      url: `/credit-customers/${primaryCustomerId}`,
    });
    assert.equal(crossTenantResponse.statusCode, 404);

    const primaryIngredientResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        code: "CAFE_TEST",
        minimumQuantity: 500,
        name: "Café de teste",
        unit: "GRAM",
      },
      url: "/ingredients",
    });
    const secondaryIngredientResponse = await secondaryApp.inject({
      method: "POST",
      payload: {
        code: "CAFE_TEST",
        minimumQuantity: 100,
        name: "Café de teste",
        unit: "GRAM",
      },
      url: "/ingredients",
    });
    assert.equal(primaryIngredientResponse.statusCode, 201);
    assert.equal(secondaryIngredientResponse.statusCode, 201);
    const primaryStockId = primaryIngredientResponse.json<{
      inventoryItem: { id: string };
    }>().inventoryItem.id;
    const secondaryStockId = secondaryIngredientResponse.json<{
      inventoryItem: { id: string };
    }>().inventoryItem.id;
    assert.notEqual(primaryStockId, secondaryStockId);

    const [primaryInventoryResponse, secondaryInventoryResponse] =
      await Promise.all([
        primaryApp.inject({ method: "GET", url: "/inventory" }),
        secondaryApp.inject({ method: "GET", url: "/inventory" }),
      ]);
    assert.deepEqual(
      primaryInventoryResponse
        .json<{ inventory: { id: string }[] }>()
        .inventory.map(({ id }) => id),
      [primaryStockId],
    );
    assert.deepEqual(
      secondaryInventoryResponse
        .json<{ inventory: { id: string }[] }>()
        .inventory.map(({ id }) => id),
      [secondaryStockId],
    );

    const entryResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: 1_000,
        reason: "Compra de teste",
        type: "ENTRY",
      },
      url: `/inventory/${primaryStockId}/movements`,
    });
    assert.equal(entryResponse.statusCode, 201);
    assert.equal(
      entryResponse.json<{ movement: { balanceAfter: number } }>().movement
        .balanceAfter,
      1_000,
    );

    const exitResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: -250,
        reason: "Consumo de teste",
        type: "EXIT",
      },
      url: `/inventory/${primaryStockId}/movements`,
    });
    assert.equal(exitResponse.statusCode, 201);
    assert.equal(
      exitResponse.json<{ movement: { balanceAfter: number } }>().movement
        .balanceAfter,
      750,
    );

    const negativeBalanceResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: -751,
        reason: "Consumo invalido",
        type: "EXIT",
      },
      url: `/inventory/${primaryStockId}/movements`,
    });
    assert.equal(negativeBalanceResponse.statusCode, 409);
    assert.equal(
      await prisma.inventoryMovement.count({
        where: {
          establishmentId: integrationEstablishmentId,
          stockId: primaryStockId,
        },
      }),
      2,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "INVENTORY_MOVEMENT_RECORDED",
          establishmentId: integrationEstablishmentId,
          resourceId: primaryStockId,
        },
      }),
      2,
    );

    const crossTenantMovementResponse = await secondaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: 10,
        reason: "Tentativa cruzada",
        type: "ENTRY",
      },
      url: `/inventory/${primaryStockId}/movements`,
    });
    assert.equal(crossTenantMovementResponse.statusCode, 404);

    await assert.rejects(
      prisma.inventoryMovement.create({
        data: {
          actorUserId: secondary.users[0].id,
          balanceAfter: 10,
          establishmentId: secondary.id,
          quantityDelta: 10,
          reason: "Tentativa direta cruzada",
          stockId: primaryStockId,
          type: "ENTRY",
        },
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003",
    );

    const duplicateProductCodes = await prisma.product.findMany({
      select: { establishmentId: true, id: true },
      where: {
        code: "CLASSIC_HAMBURGER",
        establishmentId: {
          in: [integrationEstablishmentId, secondary.id],
        },
      },
    });
    assert.equal(duplicateProductCodes.length, 2);
    assert.notEqual(duplicateProductCodes[0]?.id, duplicateProductCodes[1]?.id);
  } finally {
    await primaryApp.close();
    await secondaryApp.close();
    await cleanupEstablishment(secondaryEstablishmentName);
  }
});

void test("operational reset preserves catalog, tables and provisioned users", async () => {
  const secondary = await prisma.establishment.create({
    data: {
      name: secondaryEstablishmentName,
      normalizedName: secondaryEstablishmentName.toLocaleLowerCase("pt-BR"),
    },
  });
  const secondaryCustomer = await prisma.creditCustomer.create({
    data: {
      establishmentId: secondary.id,
      name: "Cliente preservado",
      normalizedName: "cliente preservado",
    },
  });
  const app = await createAuthenticatedApp();

  try {
    const response = await app.inject({
      method: "POST",
      payload: { name: "Cliente temporário" },
      url: "/credit-customers",
    });
    assert.equal(response.statusCode, 201);
  } finally {
    await app.close();
  }

  const tenantFilter = { establishmentId: integrationEstablishmentId };
  const productsBefore = await prisma.product.count({ where: tenantFilter });
  const tablesBefore = await prisma.restaurantTable.count({
    where: tenantFilter,
  });
  const usersBefore = await prisma.user.count({ where: tenantFilter });
  const stocksBefore = await prisma.inventoryStock.count({
    where: tenantFilter,
  });

  try {
    await resetOperationalData(prisma, integrationEstablishmentId);

    assert.equal(await prisma.comanda.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.comandaEvent.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.comandaItem.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.creditCustomer.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.creditOrder.count({ where: tenantFilter }), 0);
    assert.equal(
      await prisma.payment.count({ where: tenantFilter }),
      0,
    );
    assert.equal(
      await prisma.product.count({ where: tenantFilter }),
      productsBefore,
    );
    assert.equal(
      await prisma.restaurantTable.count({ where: tenantFilter }),
      tablesBefore,
    );
    assert.equal(await prisma.user.count({ where: tenantFilter }), usersBefore);
    assert.equal(
      await prisma.inventoryStock.count({ where: tenantFilter }),
      stocksBefore,
    );
    assert.equal(
      await prisma.restaurantTable.count({
        where: {
          activeComandaId: null,
          establishmentId: integrationEstablishmentId,
          status: "FREE",
        },
      }),
      tablesBefore,
    );
    assert.equal(
      await prisma.creditCustomer.findUnique({
        where: { id: secondaryCustomer.id },
      }).then(Boolean),
      true,
    );
  } finally {
    await cleanupEstablishment(secondaryEstablishmentName);
  }
});
