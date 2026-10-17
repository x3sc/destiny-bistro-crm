import type { Comanda } from "../../src/comanda-types.js";
import type { StatementReport } from "../../src/statement-report.js";
import type { AdminUser, AdminUsers } from "../../src/user-types.js";
import assert from "node:assert/strict";
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { after, before, test } from "node:test";
import { buildApp } from "../../src/app.js";
import { createPersistence, createPrismaClient } from "../../src/database.js";
import { provisionUser } from "../../src/user-provisioning.js";
import { resetOperationalData } from "../../src/operational-data-reset.js";
import { AuthCredentialsError } from "../../src/auth-repository.js";
import { provisionEstablishment } from "../../src/establishment-provisioning.js";
import { createComandaRepository } from "../../src/comanda-repository.js";
import { ensureSystemAccessControl } from '../../src/access-control.js';
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
const counterEstablishmentName = 'Counter Integration Bistro';
let counterEstablishmentId = '';

before(async () => {
  assertDedicatedIntegrationDatabase();
  await cleanupEstablishment(integrationEstablishmentName);
  await cleanupEstablishment(secondaryEstablishmentName);
  await cleanupEstablishment(counterEstablishmentName);
  const establishment = await provisionEstablishment(prisma, {
    name: integrationEstablishmentName,
    ownerName: integrationUserName,
    ownerPassword: integrationUserPassword,
  });
  integrationEstablishmentId = establishment.id;
  const counterEstablishment = await provisionEstablishment(prisma, {
    name: counterEstablishmentName, ownerName: 'Counter Integration Operator', ownerPassword: integrationUserPassword,
  });
  counterEstablishmentId = counterEstablishment.id;
});

after(async () => {
  await cleanupEstablishment(counterEstablishmentName);
  await cleanupEstablishment(secondaryEstablishmentName);
  await cleanupEstablishment(integrationEstablishmentName);
  await prisma.$disconnect();
});

function assertDedicatedIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(
    databaseUrl,
    "DATABASE_URL is required for MySQL integration tests",
  );

  const databaseName = new URL(databaseUrl).pathname.slice(1);
  assert.match(
    databaseName,
    /(?:integration|test)/iu,
    "Integration tests require a database name containing integration or test",
  );
  assert.equal(
    process.env.ALLOW_INTEGRATION_DB_RESET,
    "1",
    "Set ALLOW_INTEGRATION_DB_RESET=1 to confirm destructive integration cleanup",
  );
}

async function startIsolatedApi() {
  assertDedicatedIntegrationDatabase();
  const processHandle = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../../src/server.ts', import.meta.url))], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', CORS_ORIGINS: 'http://localhost' }, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const stopped = once(processHandle, 'exit');
  const stop = async () => { processHandle.kill(); await stopped; };
  try {
    const address = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Isolated API did not start')), 30_000);
      processHandle.once('error', (error) => { clearTimeout(timeout); reject(error); });
      processHandle.once('exit', () => { clearTimeout(timeout); reject(new Error('Isolated API exited before startup')); });
      processHandle.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString(); const match = /Server listening at (http:\/\/127\.0\.0\.1:\d+)/u.exec(output);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    return { address, stop };
  } catch (error) { await stop(); throw error; }
}

void test('service fee checkout is quoted, printed without payment and closed idempotently with the persisted total', async () => {
  const name = 'Service Fee Integration Bistro';
  await cleanupEstablishment(name);
  const tenant = await provisionEstablishment(prisma, { name, ownerName: 'Service Fee Integration Owner', ownerPassword: integrationUserPassword });
  const persistence = createPersistence();
  const app = await buildApp(persistence);
  const ownerId = tenant.users[0].id;
  try {
    const session = await persistence.auth.login('Service Fee Integration Owner', integrationUserPassword);
    const headers = { authorization: `Bearer ${session.token}` };
    const category = await prisma.menuCategory.findFirstOrThrow({ where: { establishmentId: tenant.id } });
    const product = await prisma.product.create({ data: { establishmentId: tenant.id, categoryId: category.id,
      code: 'FEE_TEST', name: 'Service fee item', priceCents: 1015, requiresKitchen: false } });
    const sale = await persistence.comandas.openQuickSale(tenant.id, 'Fee customer', ownerId);
    const pending = await persistence.comandas.addItem(tenant.id, sale.id, product.id, ownerId);
    await persistence.comandas.confirmItem(tenant.id, sale.id, pending.items[0].id, ownerId);
    const quoted = await app.inject({ url: `/comandas/${sale.id}/checkout-summary`, headers });
    assert.equal(quoted.statusCode, 200, quoted.body);
    const quote = quoted.json<{ expectedSnapshot: string; totalWithServiceFeeCents: number; totalWithoutServiceFeeCents: number }>();
    assert.equal(quote.totalWithServiceFeeCents, 1117); assert.equal(quote.totalWithoutServiceFeeCents, 1015);
    const printed = await app.inject({ url: `/comandas/${sale.id}/print-document?kind=CHECKOUT_PREVIEW&includeServiceFee=true&expectedSnapshot=${quote.expectedSnapshot}`, headers });
    assert.equal(printed.statusCode, 200, printed.body);
    assert.equal(printed.json<{ document: { totalCents: number } }>().document.totalCents, 1117);
    assert.equal(await prisma.payment.count({ where: { comandaId: sale.id } }), 0);
    assert.equal((await prisma.comanda.findUniqueOrThrow({ where: { id: sale.id } })).status, 'OPEN');
    const payload = { includeServiceFee: true, expectedSnapshot: quote.expectedSnapshot, requestId: 'service-fee-close-001',
      payments: [{ method: 'PIX', amountCents: 1117 }] };
    const responses = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: `/comandas/${sale.id}/close`, headers, payload })));
    assert.deepEqual(responses.map((response) => response.statusCode), [200, 200]);
    assert.deepEqual(responses[0].json(), responses[1].json());
    assert.equal(await prisma.payment.count({ where: { comandaId: sale.id } }), 1);
    const saved = await prisma.comanda.findUniqueOrThrow({ where: { id: sale.id } });
    assert.equal(saved.serviceFeeAmountCents, 102); assert.equal(saved.serviceFeePercent, 10);
    assert.equal((await app.inject({ method: 'POST', url: `/comandas/${sale.id}/close`, headers,
      payload: { ...payload, includeServiceFee: false } })).statusCode, 409);
    const receipt = await app.inject({ url: `/comandas/${sale.id}/print-document?kind=CONFIRMED`, headers });
    assert.equal(receipt.statusCode, 200); assert.equal(receipt.json<{ document: { totalCents: number } }>().document.totalCents, 1117);
    const customer = await persistence.credits.createCustomer(tenant.id, 'Fee credit customer', ownerId);
    const creditSale = await persistence.comandas.openQuickSale(tenant.id, 'Credit sale', ownerId);
    const creditItem = await persistence.comandas.addItem(tenant.id, creditSale.id, product.id, ownerId);
    await persistence.comandas.confirmItem(tenant.id, creditSale.id, creditItem.items[0].id, ownerId);
    const creditQuote = (await app.inject({ url: `/comandas/${creditSale.id}/checkout-summary`, headers })).json<{ expectedSnapshot: string }>();
    const converted = await app.inject({ method: 'POST', url: `/comandas/${creditSale.id}/close`, headers, payload: {
      includeServiceFee: true, expectedSnapshot: creditQuote.expectedSnapshot, requestId: 'fee-credit-close-001', customerId: customer.id,
      payments: [{ method: 'CASH', amountCents: 500 }],
    } });
    assert.equal(converted.statusCode, 200, converted.body);
    let credit = converted.json<{ comanda: Comanda }>().comanda.credit!;
    assert.equal(credit.totalCents, 1117); assert.equal(credit.balanceCents, 617);
    const more = await persistence.comandas.addItem(tenant.id, creditSale.id, product.id, ownerId);
    assert.equal(more.credit?.totalCents, 1117, 'Temporary quantities must not increase a fee-bearing credit debt');
    const confirmed = await persistence.comandas.confirmItem(tenant.id, creditSale.id, more.items[0].id, ownerId);
    credit = confirmed.comanda.credit!;
    assert.equal(credit.totalCents, 2233); assert.equal(confirmed.comanda.serviceFee?.amountCents, 203);
    const { parseStatementPeriod } = await import('../../src/statement-report.js');
    const report = await persistence.statements.findReport(tenant.id, parseStatementPeriod('2020-01-01', '2030-12-31'));
    assert.equal(report.entries.filter((entry) => entry.comandaId === creditSale.id).reduce((sum, entry) => sum + entry.soldCents, 0), 2233);
    assert.equal(report.entries.filter((entry) => entry.comandaId === creditSale.id).reduce((sum, entry) => sum + entry.receivedCents, 0), 500);
    assert.equal(report.entries.filter((entry) => entry.comandaId === creditSale.id).reduce((sum, entry) => sum + entry.soldItemCount, 0), 2);
    const cancelInput = { disposition: 'RETURN_TO_STOCK' as const, quantity: 1, reason: 'Erro de lançamento', requestId: 'fee-partial-cancel-001' };
    const cancelUrl = `/comandas/${creditSale.id}/items/${more.items[0].id}/configurations/${more.items[0].configurations[0].id}/cancel`;
    const cancellation = await app.inject({ method: 'POST', url: cancelUrl, headers, payload: cancelInput });
    assert.equal(cancellation.statusCode, 200, cancellation.body);
    const afterCancel = await persistence.comandas.findById(tenant.id, creditSale.id);
    assert.equal(afterCancel.credit?.totalCents, 1117); assert.equal(afterCancel.serviceFee?.amountCents, 102);
    const adjustedReport = await persistence.statements.findReport(tenant.id, parseStatementPeriod('2020-01-01', '2030-12-31'));
    assert.equal(adjustedReport.entries.filter((entry) => entry.comandaId === creditSale.id).reduce((sum, entry) => sum + entry.soldCents, 0), 1117);
    assert.ok(adjustedReport.entries.some((entry) => entry.comandaId === creditSale.id && entry.soldCents === -1116 && entry.serviceFeeCents === -101));
    const refused = await app.inject({ method: 'POST', url: cancelUrl, headers, payload: { ...cancelInput, requestId: 'fee-overpaid-cancel-001' } });
    assert.equal(refused.statusCode, 409, refused.body);
    assert.equal((await persistence.comandas.findById(tenant.id, creditSale.id)).credit?.totalCents, 1117);
    assert.equal(await prisma.inventoryOperation.count({ where: { establishmentId: tenant.id, requestId: 'fee-overpaid-cancel-001' } }), 0);
    await persistence.credits.settleOrder(tenant.id, credit.orderId, [{ method: 'PIX', amountCents: 617 }], ownerId);
    const settled = await persistence.comandas.findById(tenant.id, creditSale.id);
    assert.equal(settled.status, 'CLOSED'); assert.equal(settled.credit?.balanceCents, 0);
    assert.equal(settled.serviceFee?.amountCents, 102);
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { establishmentId: tenant.id } });
    const tableSale = await persistence.comandas.openForTable(tenant.id, table.id, null, ownerId);
    const tableItem = await persistence.comandas.addItem(tenant.id, tableSale.id, product.id, ownerId);
    const staleQuote = (await app.inject({ url: `/comandas/${tableSale.id}/checkout-summary`, headers })).json<{ expectedSnapshot: string; canClose: boolean }>();
    assert.equal(staleQuote.canClose, false);
    await persistence.comandas.confirmItem(tenant.id, tableSale.id, tableItem.items[0].id, ownerId);
    const tablePayload = { includeServiceFee: false, requestId: 'fee-table-close-001', expectedSnapshot: staleQuote.expectedSnapshot,
      payments: [{ method: 'PIX', amountCents: 1015 }] };
    assert.equal((await app.inject({ method: 'POST', url: `/comandas/${tableSale.id}/close`, headers, payload: tablePayload })).statusCode, 409);
    assert.equal((await app.inject({ url: `/comandas/${tableSale.id}/print-document?kind=CHECKOUT_PREVIEW&includeServiceFee=false&expectedSnapshot=${staleQuote.expectedSnapshot}`, headers })).statusCode, 409);
    const tableQuote = (await app.inject({ url: `/comandas/${tableSale.id}/checkout-summary`, headers })).json<{ expectedSnapshot: string }>();
    tablePayload.expectedSnapshot = tableQuote.expectedSnapshot;
    const waivedPreview = await app.inject({ url: `/comandas/${tableSale.id}/print-document?kind=CHECKOUT_PREVIEW&includeServiceFee=false&expectedSnapshot=${tableQuote.expectedSnapshot}`, headers });
    assert.equal(waivedPreview.statusCode, 200, waivedPreview.body);
    assert.equal(waivedPreview.json<{ document: { totalCents: number } }>().document.totalCents, 1015);
    // A real database failure must roll back every financial side effect, including the fee decision.
    assert.match(tableSale.id, /^[a-z0-9]+$/u);
    await prisma.$executeRawUnsafe(`ALTER TABLE AuditLog ADD CONSTRAINT fee_audit_failure CHECK (NOT (action = 'COMANDA_CLOSED' AND resourceId = '${tableSale.id}'))`);
    try {
      const failed = await app.inject({ method: 'POST', url: `/comandas/${tableSale.id}/close`, headers, payload: tablePayload });
      assert.equal(failed.statusCode, 503, failed.body);
      const unchanged = await prisma.comanda.findUniqueOrThrow({ where: { id: tableSale.id } });
      assert.equal(unchanged.status, 'OPEN'); assert.equal(unchanged.serviceFeeApplied, null);
      assert.equal(await prisma.payment.count({ where: { comandaId: tableSale.id } }), 0);
      assert.equal(await prisma.comandaCheckoutOperation.count({ where: { comandaId: tableSale.id } }), 0);
      assert.equal(await prisma.comandaEvent.count({ where: { comandaId: tableSale.id, type: 'SERVICE_FEE_CHANGED' } }), 0);
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE AuditLog DROP CHECK fee_audit_failure'); }
    const waived = await app.inject({ method: 'POST', url: `/comandas/${tableSale.id}/close`, headers, payload: tablePayload });
    assert.equal(waived.statusCode, 200, waived.body);
    const waivedSaved = await prisma.comanda.findUniqueOrThrow({ where: { id: tableSale.id } });
    assert.equal(waivedSaved.serviceFeeApplied, false); assert.equal(waivedSaved.serviceFeeAmountCents, 0);
    const foreignSession = await persistence.auth.login(integrationUserName, integrationUserPassword);
    const foreignQuote = await app.inject({ url: `/comandas/${sale.id}/checkout-summary`, headers: { authorization: `Bearer ${foreignSession.token}` } });
    assert.equal(foreignQuote.statusCode, 404);
    const manual = await persistence.credits.createOrder(tenant.id, customer.id, ownerId);
    const delivery = await persistence.deliveries.createOrder(tenant.id, { customerName: 'Fee excluded', phone: '11999999999', address: 'Rua teste', feeCents: 0 }, ownerId);
    for (const excludedId of [manual.comandaId, delivery.comandaId]) {
      const excluded = await app.inject({ url: `/comandas/${excludedId}/checkout-summary`, headers });
      assert.equal(excluded.statusCode, 200, excluded.body);
      const excludedQuote = excluded.json<{ expectedSnapshot: string; eligible: boolean }>();
      assert.equal(excludedQuote.eligible, false);
      const rejected = await app.inject({ method: 'POST', url: `/comandas/${excludedId}/close`, headers,
        payload: { includeServiceFee: true, expectedSnapshot: excludedQuote.expectedSnapshot, requestId: `fee-excluded-${excludedId}`, payments: [] } });
      assert.ok(rejected.statusCode >= 400, rejected.body);
      assert.equal((await prisma.comanda.findUniqueOrThrow({ where: { id: excludedId } })).serviceFeeApplied, null);
    }
    const real = await startIsolatedApi();
    try {
      const realQuote = await fetch(`${real.address}/comandas/${sale.id}/checkout-summary`, { headers });
      assert.equal(realQuote.status, 200);
      const closedQuote = await realQuote.json() as { totalWithServiceFeeCents: number; eligible: boolean };
      assert.equal(closedQuote.totalWithServiceFeeCents, 1117); assert.equal(closedQuote.eligible, false);
      const realReplay = await fetch(`${real.address}/comandas/${sale.id}/close`, { method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal(realReplay.status, 200);
      assert.equal(await prisma.payment.count({ where: { comandaId: sale.id } }), 1);
    } finally { await real.stop(); }
  } finally { await app.close(); await cleanupEstablishment(name); }
});

void test('server entry wires tenant roles into the running API', async () => {
  const server = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../../src/server.ts', import.meta.url))], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', CORS_ORIGINS: 'http://localhost' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const stopped = once(server, 'exit');
  try {
    const address = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Isolated API did not start')), 30_000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.once('exit', () => { clearTimeout(timeout); reject(new Error('Isolated API exited before startup')); });
      server.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        const match = /Server listening at (http:\/\/127\.0\.0\.1:\d+)/u.exec(output);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    const login = await fetch(`${address}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: integrationUserName, password: integrationUserPassword }) });
    assert.equal(login.status, 200);
    const session = await login.json() as { session: { token: string } };
    const roles = await fetch(`${address}/admin/roles`, { headers: { Authorization: `Bearer ${session.session.token}` } });
    assert.equal(roles.status, 200);
    const data = await roles.json() as { roles: { code: string; protected: boolean }[] };
    assert.ok(data.roles.some((role) => role.code === 'OWNER' && role.protected));
  } finally { server.kill(); await stopped; }
});

void test('tenant roles delegate safely, isolate users and enforce operational origins on shared endpoints', async () => {
  const name = 'Roles Integration Bistro';
  await cleanupEstablishment(name);
  const tenant = await provisionEstablishment(prisma, { name, ownerName: 'Roles Integration Owner', ownerPassword: integrationUserPassword });
  const persistence = createPersistence();
  const app = await buildApp(persistence);
  const login = async (user: string) => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { name: user, password: integrationUserPassword } });
    assert.equal(response.statusCode, 200, response.body);
    return { authorization: `Bearer ${response.json<{ session: { token: string } }>().session.token}` };
  };
  try {
    const owner = await login('Roles Integration Owner');
    const createRole = async (name: string, permissions: string[], headers = owner) => {
      const response = await app.inject({ method: 'POST', url: '/admin/roles', headers, payload: { name, permissions } });
      assert.equal(response.statusCode, 201, response.body);
      return response.json<{ role: { id: string; version: number; name: string; permissions: string[] } }>().role;
    };
    const operatorRole = await createRole('Operador de Balcão', ['counter-sales.read', 'counter-sales.write', 'products.read', 'printing.write']);
    const adminRole = await createRole('Administrador delegado', ['roles.manage', 'users.manage', 'counter-sales.read', 'counter-sales.write', 'products.read', 'printing.write']);
    const createUser = async (name: string, roleId: string, headers = owner) => {
      const response = await app.inject({ method: 'POST', url: '/admin/users', headers, payload: { name, password: integrationUserPassword, roleId } });
      assert.equal(response.statusCode, 201, response.body);
      return response.json<{ user: { id: string; roleVersion: number } }>().user;
    };
    const operator = await createUser('Roles Counter Operator', operatorRole.id);
    const admin = await createUser('Roles Delegated Admin', adminRole.id);
    const delegate = await login('Roles Delegated Admin');
    const operatorHeaders = await login('Roles Counter Operator');
    for (const payload of [
      { name: 'Invalid permissions', permissions: ['unknown.read'] },
      { name: 'Invalid dependencies', permissions: ['counter-sales.write'] },
      { name: 'Pretend owner', permissions: [], code: 'OWNER' },
    ]) assert.equal((await app.inject({ method: 'POST', url: '/admin/roles', headers: owner, payload })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: '/admin/roles', headers: owner,
      payload: { name: '  OPERADOR   DE BALCÃO ', permissions: [] } })).statusCode, 409);
    const childRole = await createRole('Consulta delegada', ['counter-sales.read'], delegate);
    const childUser = await createUser('Roles Delegated Child', childRole.id, delegate);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/users/${childUser.id}/role`, headers: delegate,
      payload: { roleId: operatorRole.id, expectedVersion: 1 } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/users/${childUser.id}/role`, headers: delegate,
      payload: { roleId: operatorRole.id, expectedVersion: 1 } })).statusCode, 409);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/users/${childUser.id}/role`, headers: delegate,
      payload: { roleId: childRole.id, expectedVersion: 2 } })).statusCode, 200);
    await prisma.user.update({ where: { id: childUser.id }, data: { active: false } });
    assert.equal((await app.inject({ method: 'DELETE', url: `/admin/roles/${childRole.id}`, headers: owner,
      payload: { expectedVersion: 1 } })).statusCode, 409);
    for (const payload of [
      { name: 'Elevação', permissions: ['statements.read'] },
      { name: 'Elevação', permissions: ['roles.manage'] },
    ]) assert.equal((await app.inject({ method: 'POST', url: '/admin/roles', headers: delegate, payload })).statusCode, 403);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/roles/${adminRole.id}`, headers: delegate,
      payload: { name: adminRole.name, permissions: adminRole.permissions, expectedVersion: 1 } })).statusCode, 403);
    const list = await app.inject({ method: 'GET', url: '/admin/roles', headers: owner });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json<{ permissions: { code: string; ownerOnly: boolean }[] }>().permissions.find((permission) => permission.code === 'roles.manage')?.ownerOnly, false);
    const protectedRole = list.json<{ roles: { id: string; protected: boolean }[] }>().roles.find((role) => role.protected)!;
    assert.equal((await app.inject({ method: 'DELETE', url: `/admin/roles/${protectedRole.id}`, headers: owner, payload: { expectedVersion: 1 } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'DELETE', url: `/admin/roles/${operatorRole.id}`, headers: owner, payload: { expectedVersion: 1 } })).statusCode, 409);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/users/${admin.id}/role`, headers: delegate,
      payload: { roleId: operatorRole.id, expectedVersion: 1 } })).statusCode, 403);
    const otherRole = await prisma.tenantRole.findFirstOrThrow({ where: { establishmentId: integrationEstablishmentId } });
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/roles/${otherRole.id}`, headers: owner,
      payload: { name: 'Cross tenant', permissions: [], expectedVersion: 1 } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/users/${operator.id}/role`, headers: owner,
      payload: { roleId: otherRole.id, expectedVersion: 1 } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: '/counter-sales', headers: operatorHeaders })).statusCode, 200);
    for (const url of ['/quick-sales', '/tables', '/credit-customers', '/delivery/orders']) {
      assert.equal((await app.inject({ method: 'GET', url, headers: operatorHeaders })).statusCode, 403, url);
    }
    const opened = await app.inject({ method: 'POST', url: '/counter-sales', headers: operatorHeaders, payload: { requestId: 'roles-counter-open-001' } });
    assert.equal(opened.statusCode, 200, opened.body);
    const counterId = opened.json<{ comanda: { id: string } }>().comanda.id;
    assert.equal((await app.inject({ method: 'GET', url: `/comandas/${counterId}`, headers: operatorHeaders })).statusCode, 200);
    const ownerId = tenant.users[0].id;
    const quick = await persistence.comandas.openQuickSale(tenant.id, 'Cliente', ownerId);
    const table = await prisma.restaurantTable.findFirstOrThrow({ where: { establishmentId: tenant.id } });
    const mesa = await persistence.comandas.openForTable(tenant.id, table.id, null, ownerId);
    const customer = await persistence.credits.createCustomer(tenant.id, 'Cliente de fiado', ownerId);
    const creditOrder = await persistence.credits.createOrder(tenant.id, customer.id, ownerId);
    const delivery = await persistence.deliveries.createOrder(tenant.id, { customerName: 'Cliente', phone: '11999999999', address: 'Rua de teste', feeCents: 0 }, ownerId);
    for (const id of [quick.id, mesa.id, creditOrder.comandaId, delivery.comandaId]) {
      assert.equal((await app.inject({ url: `/comandas/${id}/checkout-summary`, headers: operatorHeaders })).statusCode, 403);
      for (const method of ['GET', 'POST'] as const) {
        const url = `/comandas/${id}${method === 'POST' ? '/items' : ''}`;
        const response = await app.inject({ method, url, headers: operatorHeaders, ...(method === 'POST' ? { payload: { productId: 'invalid' } } : {}) });
        assert.equal(response.statusCode, 403, response.body);
      }
    }
    assert.equal((await app.inject({ method: 'GET', url: `/comandas/${quick.id}/print-document?kind=CONFIRMED`, headers: operatorHeaders })).statusCode, 403);
    const update = await app.inject({ method: 'PATCH', url: `/admin/roles/${operatorRole.id}`, headers: owner,
      payload: { name: operatorRole.name, permissions: ['counter-sales.read', 'products.read'], expectedVersion: 1 } });
    assert.equal(update.statusCode, 200, update.body);
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/roles/${operatorRole.id}`, headers: owner,
      payload: { name: operatorRole.name, permissions: [], expectedVersion: 1 } })).statusCode, 409);
    assert.equal((await app.inject({ method: 'POST', url: '/counter-sales', headers: operatorHeaders, payload: { requestId: 'roles-counter-open-002' } })).statusCode, 403);
    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: operatorHeaders });
    assert.ok(!me.json<{ user: { permissions: string[] } }>().user.permissions.includes('counter-sales.write'));
    const unused = await createRole('Cargo sem usuários', [], owner);
    const deletes = await Promise.all([1, 1].map((expectedVersion) => app.inject({ method: 'DELETE', url: `/admin/roles/${unused.id}`, headers: owner, payload: { expectedVersion } })));
    assert.deepEqual(deletes.map((response) => response.statusCode).sort(), [204, 404]);
    assert.equal(await prisma.auditLog.count({ where: { establishmentId: tenant.id, action: 'ROLE_DELETED', resourceId: unused.id } }), 1);
    const atomic = await createRole('Cargo atômico', ['counter-sales.read']);
    assert.match(atomic.id, /^[a-z0-9]+$/);
    await prisma.$executeRawUnsafe(`ALTER TABLE AuditLog ADD CONSTRAINT roles_audit_failure CHECK (NOT (action = 'ROLE_UPDATED' AND resourceId = '${atomic.id}'))`);
    try {
      const failure = await app.inject({ method: 'PATCH', url: `/admin/roles/${atomic.id}`, headers: owner,
        payload: { name: 'Não deve persistir', permissions: [], expectedVersion: 1 } });
      assert.equal(failure.statusCode, 503);
      const unchanged = await prisma.tenantRole.findUniqueOrThrow({ where: { id: atomic.id }, include: { permissions: true } });
      assert.equal(unchanged.version, 1); assert.equal(unchanged.name, atomic.name); assert.equal(unchanged.permissions.length, 1);
      assert.equal(await prisma.auditLog.count({ where: { action: 'ROLE_UPDATED', resourceId: atomic.id } }), 0);
    } finally { await prisma.$executeRawUnsafe('ALTER TABLE AuditLog DROP CHECK roles_audit_failure'); }
    const concurrentEdits = await Promise.all(['Cargo concorrente A', 'Cargo concorrente B'].map((name) => app.inject({
      method: 'PATCH', url: `/admin/roles/${atomic.id}`, headers: owner, payload: { name, permissions: [], expectedVersion: 1 },
    })));
    assert.deepEqual(concurrentEdits.map((response) => response.statusCode).sort(), [200, 409]);
    assert.equal(await prisma.auditLog.count({ where: { action: 'ROLE_UPDATED', resourceId: atomic.id } }), 1);
    const customized = await prisma.tenantRole.findUniqueOrThrow({ where: { id: atomic.id }, include: { permissions: true } });
    await ensureSystemAccessControl(prisma);
    assert.deepEqual(await prisma.tenantRole.findUniqueOrThrow({ where: { id: atomic.id }, include: { permissions: true } }), customized);
    const financeRole = await createRole('Financeiro', ['credits.read', 'credits.write', 'products.read']);
    await createUser('Roles Finance Operator', financeRole.id);
    const financeHeaders = await login('Roles Finance Operator');
    assert.equal((await app.inject({ method: 'GET', url: '/credit-customers', headers: financeHeaders })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: `/comandas/${creditOrder.comandaId}`, headers: financeHeaders })).statusCode, 200);
    const tableRole = await createRole('Operador de mesas', ['comandas.read', 'comandas.write', 'products.read']);
    await createUser('Roles Table Operator', tableRole.id);
    const tableHeaders = await login('Roles Table Operator');
    const product = await prisma.product.findFirstOrThrow({ where: { establishmentId: tenant.id, active: true } });
    const added = await persistence.comandas.addItem(tenant.id, mesa.id, product.id, ownerId);
    await persistence.comandas.confirmItemsBatch(tenant.id, mesa.id, { requestId: 'roles-source-race-confirm', items: added.items.map((item) => ({
      itemId: item.id, expectedQuantity: item.quantity, expectedConfirmedQuantity: item.confirmedQuantity,
    })) }, ownerId);
    // A second authenticated operation changes the persisted origin after the first request's pre-handler.
    const addItem = persistence.comandas.addItem.bind(persistence.comandas);
    persistence.comandas.addItem = async (...args) => {
      persistence.comandas.addItem = addItem;
      const conversion = await app.inject({ method: 'POST', url: `/comandas/${mesa.id}/credit`, headers: owner, payload: { customerId: customer.id } });
      assert.equal(conversion.statusCode, 200, conversion.body);
      return addItem(...args);
    };
    const race = await app.inject({ method: 'POST', url: `/comandas/${mesa.id}/items`, headers: tableHeaders, payload: { productId: product.id } });
    assert.equal(race.statusCode, 403, race.body);
    const afterRace = await persistence.comandas.findById(tenant.id, mesa.id);
    assert.ok(afterRace.items.every((item) => item.quantity === item.confirmedQuantity));
    const secondOwner = await createUser('Roles Second Owner', protectedRole.id);
    const secondOwnerHeaders = await login('Roles Second Owner');
    assert.equal((await app.inject({ method: 'PATCH', url: `/admin/users/${ownerId}/role`, headers: owner,
      payload: { roleId: operatorRole.id, expectedVersion: 1 } })).statusCode, 403);
    const demotions = await Promise.all([
      app.inject({ method: 'PATCH', url: `/admin/users/${secondOwner.id}/role`, headers: owner, payload: { roleId: operatorRole.id, expectedVersion: 1 } }),
      app.inject({ method: 'PATCH', url: `/admin/users/${ownerId}/role`, headers: secondOwnerHeaders, payload: { roleId: operatorRole.id, expectedVersion: 1 } }),
    ]);
    assert.deepEqual(demotions.map((response) => response.statusCode).sort(), [200, 403]);
    assert.equal(await prisma.user.count({ where: { establishmentId: tenant.id, active: true, localRole: { protected: true } } }), 1);
  } finally { await app.close(); await cleanupEstablishment(name); }
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
    await transaction.counterSaleOperation.deleteMany({ where: { establishmentId } });
    await transaction.comandaCheckoutOperation.deleteMany({ where: { establishmentId } });
    await transaction.paymentAllocation.deleteMany({ where: { establishmentId } });
    await transaction.payment.deleteMany({
      where: { establishmentId },
    });
    await transaction.creditOrder.deleteMany({ where: { establishmentId } });
    await transaction.creditCustomer.deleteMany({
      where: { establishmentId },
    });
    await transaction.deliveryOrder.deleteMany({ where: { establishmentId } });
    await transaction.inventoryMovementLot.deleteMany({ where: { establishmentId } });
    await transaction.inventoryMovement.deleteMany({ where: { establishmentId } });
    await transaction.inventoryOperation.deleteMany({ where: { establishmentId } });
    await transaction.inventoryLot.deleteMany({ where: { establishmentId } });
    await transaction.kitchenTicketItemAdditional.deleteMany({ where: { establishmentId } });
    await transaction.kitchenTicketItemConfiguration.deleteMany({ where: { establishmentId } });
    await transaction.kitchenTicketItem.deleteMany({ where: { establishmentId } });
    await transaction.kitchenTicket.deleteMany({ where: { establishmentId } });
    await transaction.comandaConfirmationBatch.deleteMany({
      where: { establishmentId },
    });
    await transaction.comandaItemCancellation.deleteMany({ where: { establishmentId } });
    await transaction.comandaItemAdditional.deleteMany({ where: { establishmentId } });
    await transaction.comandaItemConfiguration.deleteMany({ where: { establishmentId } });
    await transaction.comandaItem.deleteMany({ where: { establishmentId } });
    await transaction.comandaEvent.deleteMany({ where: { establishmentId } });
    await transaction.comanda.deleteMany({ where: { establishmentId } });
    await transaction.comandaDailySequence.deleteMany({ where: { establishmentId } });
    await transaction.inventoryStock.deleteMany({
      where: { establishmentId },
    });
    await transaction.productAdditional.deleteMany({ where: { establishmentId } });
    await transaction.additionalIngredient.deleteMany({ where: { establishmentId } });
    await transaction.productIngredient.deleteMany({ where: { establishmentId } });
    await transaction.ingredient.deleteMany({ where: { establishmentId } });
    await transaction.deliveryExpense.deleteMany({ where: { establishmentId } });
    await transaction.delivery.deleteMany({ where: { establishmentId } });
    await transaction.deliveryDay.deleteMany({ where: { establishmentId } });
    await transaction.deliveryCourier.deleteMany({ where: { establishmentId } });
    await transaction.auditLog.deleteMany({ where: { establishmentId } });
    await transaction.authSession.deleteMany({
      where: { user: { establishmentId } },
    });
    await transaction.userRole.deleteMany({
      where: { user: { establishmentId } },
    });
    await transaction.user.deleteMany({ where: { establishmentId } });
    await transaction.tenantRole.deleteMany({ where: { establishmentId } });
    await transaction.product.deleteMany({ where: { establishmentId } });
    await transaction.additional.deleteMany({ where: { establishmentId } });
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

void test('counter sales persist retries, isolate tenants, serialize item changes and record external payment once', async () => {
  const repository = createComandaRepository(prisma);
  const counter = repository.counterSales;
  assert.ok(counter, 'Counter sales repository must be available');
  const actor = await prisma.user.findFirstOrThrow({ where: { establishmentId: counterEstablishmentId } });
  const tenant = counterEstablishmentId;
  const [opened, retry] = await Promise.all([
    counter.open(tenant, actor.id, 'counter-open-001'), counter.open(tenant, actor.id, 'counter-open-001'),
  ]);
  assert.equal(opened.id, retry.id);
  assert.equal(opened.name, null);
  assert.equal(opened.tableName, 'Balcão');
  assert.ok(opened.counterSnapshot);
  assert.equal((await repository.listQuickSales(tenant)).some((sale) => sale.id === opened.id), false);
  await assert.rejects(counter.complete('foreign-tenant', actor.id, opened.id, 'counter-close-001', opened.counterSnapshot));
  await assert.rejects(counter.complete(tenant, actor.id, opened.id, 'counter-close-empty', opened.counterSnapshot));
  await assert.rejects(counter.complete(tenant, actor.id, opened.id, 'counter-open-001', opened.counterSnapshot));
  const category = await prisma.menuCategory.findFirstOrThrow({ where: { establishmentId: tenant } });
  const product = await prisma.product.create({ data: { establishmentId: tenant, categoryId: category.id,
    code: 'counter-integration', name: 'Counter integration item', priceCents: 500, requiresKitchen: true } });
  const added = await repository.addItem(tenant, opened.id, product.id, actor.id);
  assert.ok(added.counterSnapshot);
  await assert.rejects(counter.complete(tenant, actor.id, opened.id, 'counter-close-pending', added.counterSnapshot));
  const confirmation = { requestId: 'counter-batch-confirm', items: [{ itemId: added.items[0].id,
    expectedQuantity: added.items[0].quantity, expectedConfirmedQuantity: added.items[0].confirmedQuantity }] };
  await Promise.all([
    repository.confirmItemsBatch(tenant, opened.id, confirmation, actor.id),
    repository.confirmItemsBatch(tenant, opened.id, confirmation, actor.id),
  ]);
  const renamed = await counter.rename(tenant, actor.id, opened.id, 'Cliente balcão');
  assert.equal(renamed.name, 'Cliente balcão');
  const snapshot = renamed.counterSnapshot;
  assert.ok(snapshot);
  await assert.rejects(counter.complete(tenant, actor.id, opened.id, 'counter-close-stale', opened.counterSnapshot));
  const closed = await Promise.all([
    counter.complete(tenant, actor.id, opened.id, 'counter-close-001', snapshot),
    counter.complete(tenant, actor.id, opened.id, 'counter-close-001', snapshot),
  ]);
  assert.ok(closed.every((sale) => sale.status === 'CLOSED'));
  assert.equal(closed[0].payments.length, 1);
  assert.equal(closed[0].payments[0].origin, 'COUNTER_CHECKOUT');
  assert.deepEqual(closed[0].payments[0].allocations.map(({ amountCents, method }) => ({ amountCents, method })), [{ amountCents: 500, method: 'COUNTER' }]);
  assert.equal(await prisma.comandaEvent.count({ where: { comandaId: opened.id, type: 'CLOSED' } }), 1);
  assert.equal(await prisma.kitchenTicket.count({ where: { comandaId: opened.id } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { resourceId: opened.id, action: 'COUNTER_SALE_COMPLETED' } }), 1);
  await assert.rejects(counter.complete(tenant, actor.id, opened.id, 'counter-close-new-key', snapshot));
  await assert.rejects(counter.rename(tenant, actor.id, opened.id, 'Changed'));
  const race = await counter.open(tenant, actor.id, 'counter-open-race');
  const raceItem = await repository.addItem(tenant, race.id, product.id, actor.id);
  await repository.confirmItem(tenant, race.id, raceItem.items[0].id, actor.id);
  const raceReady = await repository.findById(tenant, race.id);
  assert.ok(raceReady.counterSnapshot);
  const outcomes = await Promise.allSettled([
    counter.complete(tenant, actor.id, race.id, 'counter-close-race', raceReady.counterSnapshot), repository.addItem(tenant, race.id, product.id, actor.id),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
});

void test('counter sales dates use Sao Paulo and failed payments roll back the whole completion', async () => {
  const tenant = counterEstablishmentId;
  const actor = await prisma.user.findFirstOrThrow({ where: { establishmentId: tenant } });
  let now = new Date('2026-10-16T02:59:59.000Z');
  const repository = createComandaRepository(prisma, () => now);
  const counter = repository.counterSales;
  assert.ok(counter);
  const opened = await counter.open(tenant, actor.id, 'counter-boundary-open');
  const product = await prisma.product.findFirstOrThrow({ where: { establishmentId: tenant, active: true, priceCents: { gt: 0 } } });
  const added = await repository.addItem(tenant, opened.id, product.id, actor.id);
  await repository.confirmItem(tenant, opened.id, added.items[0].id, actor.id);
  const ready = await repository.findById(tenant, opened.id);
  assert.ok(ready.counterSnapshot);
  await assert.rejects(counter.complete(tenant, 'missing-actor', opened.id, 'counter-rollback-close', ready.counterSnapshot));
  assert.equal((await repository.findById(tenant, opened.id)).status, 'OPEN');
  assert.equal(await prisma.payment.count({ where: { comandaId: opened.id } }), 0);
  assert.equal(await prisma.counterSaleOperation.count({ where: { comandaId: opened.id, action: 'COMPLETE' } }), 0);
  now = new Date('2026-10-16T03:00:00.000Z');
  await counter.complete(tenant, actor.id, opened.id, 'counter-boundary-close', ready.counterSnapshot);
  assert.equal((await counter.list(tenant, 'CLOSED', '2026-10-15')).some((sale) => sale.id === opened.id), false);
  assert.equal((await counter.list(tenant, 'CLOSED', '2026-10-16')).some((sale) => sale.id === opened.id), true);
  assert.equal((await counter.list(integrationEstablishmentId, 'CLOSED', '2026-10-16')).some((sale) => sale.id === opened.id), false);
  const cancelled = await counter.open(tenant, actor.id, 'counter-empty-cancel');
  assert.equal((await repository.cancel(tenant, cancelled.id, null, false, actor.id)).status, 'CANCELLED');
});

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

void test("comanda numbers restart per establishment and Sao Paulo opening date", async () => {
  const secondaryOwnerName = "Daily Sequence Owner";
  const secondary = await provisionEstablishment(prisma, {
    name: secondaryEstablishmentName,
    ownerName: secondaryOwnerName,
    ownerPassword: integrationUserPassword,
  });
  const primaryOwner = await prisma.user.findFirstOrThrow({
    select: { id: true },
    where: { establishmentId: integrationEstablishmentId },
  });
  const beforeMidnight = new Date("2032-01-02T02:59:59.999Z");
  const afterMidnight = new Date("2032-01-02T03:00:00.000Z");
  const firstDayRepository = createComandaRepository(prisma, () => beforeMidnight);
  const nextDayRepository = createComandaRepository(prisma, () => afterMidnight);

  try {
    const [first, second] = await Promise.all([
      firstDayRepository.openQuickSale(
        integrationEstablishmentId,
        "Primeira concorrente",
        primaryOwner.id,
      ),
      firstDayRepository.openQuickSale(
        integrationEstablishmentId,
        "Segunda concorrente",
        primaryOwner.id,
      ),
    ]);
    const secondaryFirst = await firstDayRepository.openQuickSale(
      secondary.id,
      "Primeira secundária",
      secondary.users[0].id,
    );
    const nextDayFirst = await nextDayRepository.openQuickSale(
      integrationEstablishmentId,
      "Primeira do novo dia",
      primaryOwner.id,
    );
    const persisted = await prisma.comanda.findMany({
      orderBy: { number: "asc" },
      select: { number: true, openedAt: true, openedDate: true },
      where: { id: { in: [first.id, second.id] } },
    });

    assert.deepEqual([first.number, second.number].sort(), [1, 2]);
    assert.equal(secondaryFirst.number, 1);
    assert.equal(nextDayFirst.number, 1);
    assert.deepEqual(
      persisted.map(({ openedAt, openedDate, number }) => ({
        number,
        openedAt: openedAt.toISOString(),
        openedDate: openedDate.toISOString().slice(0, 10),
      })),
      [
        { number: 1, openedAt: beforeMidnight.toISOString(), openedDate: "2032-01-01" },
        { number: 2, openedAt: beforeMidnight.toISOString(), openedDate: "2032-01-01" },
      ],
    );
  } finally {
    await cleanupEstablishment(secondaryEstablishmentName);
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
        openedAt: string;
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
          activeComanda: { id: string; name: string | null; number: number; openedAt: string } | null;
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
        openedAt: openedComanda.openedAt,
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
      payload: {},
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

void test("pending-only cancellation ignores stock disposition and is idempotent", async () => {
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 12 },
  });
  const product = await prisma.product.findFirstOrThrow({
    where: { active: true, establishmentId: integrationEstablishmentId },
  });
  const app = await createAuthenticatedApp();

  try {
    const opened = await app.inject({
      method: "POST",
      url: `/tables/${table.id}/comandas`,
    });
    const comandaId = opened.json<{ comanda: { id: string } }>().comanda.id;
    const addedItem = await app.inject({
      method: "POST",
      payload: { productId: product.id },
      url: `/comandas/${comandaId}/items`,
    });
    const itemId = addedItem.json<{ comanda: Comanda }>().comanda.items[0].id;
    const requestId = "pending-only-cancel-request";
    const cancelled = await app.inject({
      method: "POST",
      payload: {
        disposition: "LOSS",
        reason: "  Cliente   desistiu  ",
        requestId,
      },
      url: `/comandas/${comandaId}/cancel`,
    });

    assert.equal(cancelled.statusCode, 200, cancelled.body);
    assert.equal(
      cancelled.json<{ comanda: Comanda }>().comanda.status,
      "CANCELLED",
    );
    assert.deepEqual(
      await prisma.comandaItem.findUniqueOrThrow({
        select: { confirmedQuantity: true, quantity: true },
        where: { id: itemId },
      }),
      { confirmedQuantity: 0, quantity: 0 },
    );
    assert.equal(
      await prisma.inventoryMovement.count({
        where: {
          establishmentId: integrationEstablishmentId,
          operation: { comandaId },
        },
      }),
      0,
    );

    const operation = await prisma.inventoryOperation.findUniqueOrThrow({
      where: {
        establishmentId_requestId: {
          establishmentId: integrationEstablishmentId,
          requestId,
        },
      },
    });
    assert.equal(operation.reason, "Cliente desistiu");
    assert.equal(operation.requestFingerprint?.length, 64);

    const replay = await app.inject({
      method: "POST",
      payload: {
        reason: "Cliente desistiu",
        requestId,
      },
      url: `/comandas/${comandaId}/cancel`,
    });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(
      await prisma.inventoryOperation.count({
        where: { establishmentId: integrationEstablishmentId, requestId },
      }),
      1,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "COMANDA_CANCELLED",
          establishmentId: integrationEstablishmentId,
          resourceId: comandaId,
        },
      }),
      1,
    );
    assert.deepEqual(
      await prisma.restaurantTable.findUniqueOrThrow({
        select: { activeComandaId: true, status: true },
        where: { id: table.id },
      }),
      { activeComandaId: null, status: "FREE" },
    );
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
        requiresKitchen: true,
      },
      url: "/admin/products",
    });
    assert.equal(productResponse.statusCode, 201);
    const product = productResponse.json<{
      product: { id: string; requiresKitchen: boolean };
    }>().product;
    assert.equal(product.requiresKitchen, true);

    const publicCatalog = await app.inject({ method: "GET", url: "/products" });
    assert.equal(
      publicCatalog
        .json<{ products: { id: string; requiresKitchen: boolean }[] }>()
        .products.some(
          ({ id, requiresKitchen }) =>
            id === product.id && requiresKitchen === true,
        ),
      true,
    );

    const updateProduct = await app.inject({
      method: "PATCH",
      payload: {
        active: true,
        categoryId: category.id,
        description: "Fatia",
        name: "Torta de integracao",
        priceCents: 1250,
        requiresKitchen: false,
      },
      url: `/admin/products/${product.id}`,
    });
    assert.equal(updateProduct.statusCode, 200);
    assert.equal(
      updateProduct.json<{ product: { requiresKitchen: boolean } }>().product
        .requiresKitchen,
      false,
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
          action: {
            in: [
              "MENU_CATEGORY_CREATED",
              "MENU_PRODUCT_CREATED",
              "MENU_PRODUCT_UPDATED",
              "MENU_CATEGORY_DEACTIVATED",
            ],
          },
          establishmentId: integrationEstablishmentId,
          resourceId: { in: [category.id, product.id] },
        },
      }),
      4,
    );
  } finally {
    await app.close();
  }
});

void test("kitchen tickets snapshot confirmed deltas, isolate tenants and roll back atomically", async () => {
  const category = await prisma.menuCategory.create({
    data: {
      establishmentId: integrationEstablishmentId,
      name: "Cozinha integracao",
      normalizedName: "cozinha integracao",
    },
  });
  const kitchenProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "INTEGRATION_KITCHEN_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Hamburguer cozinha",
      priceCents: 2_500,
      requiresKitchen: true,
    },
  });
  const commonProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "INTEGRATION_COMMON_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Agua cozinha",
      priceCents: 500,
    },
  });
  assert.equal(commonProduct.requiresKitchen, false);
  const additional = await prisma.additional.create({
    data: {
      code: "INTEGRATION_KITCHEN_BACON",
      establishmentId: integrationEstablishmentId,
      name: "Bacon cozinha",
      priceCents: 300,
    },
  });
  await prisma.productAdditional.create({
    data: {
      additionalId: additional.id,
      establishmentId: integrationEstablishmentId,
      productId: kitchenProduct.id,
    },
  });
  const table = await prisma.restaurantTable.create({
    data: { establishmentId: integrationEstablishmentId, number: 91 },
  });
  const app = await createAuthenticatedApp();
  let secondaryApp: Awaited<ReturnType<typeof createAuthenticatedApp>> | null =
    null;
  let comandaId = "";
  let kitchenItemId = "";

  try {
    const opened = await app.inject({
      method: "POST",
      url: `/tables/${table.id}/comandas`,
    });
    assert.equal(opened.statusCode, 201);
    comandaId = opened.json<{ comanda: { id: string } }>().comanda.id;

    const firstAdd = await app.inject({
      method: "POST",
      payload: { productId: kitchenProduct.id },
      url: `/comandas/${comandaId}/items`,
    });
    kitchenItemId = firstAdd.json<{
      comanda: { items: Array<{ id: string }> };
    }>().comanda.items[0].id;
    await app.inject({
      method: "POST",
      payload: { productId: kitchenProduct.id },
      url: `/comandas/${comandaId}/items`,
    });
    const configured = await app.inject({
      method: "PUT",
      payload: {
        additionals: [
          { additionalId: additional.id, quantityPerUnit: 1 },
        ],
        quantity: 1,
        requestId: "kitchen-configuration-request",
      },
      url: `/comandas/${comandaId}/items/${kitchenItemId}/additionals`,
    });
    assert.equal(configured.statusCode, 200);

    await prisma.product.update({
      data: { requiresKitchen: false },
      where: { id: kitchenProduct.id },
    });
    assert.equal(
      (
        await prisma.comandaItem.findUniqueOrThrow({
          where: { id: kitchenItemId },
        })
      ).requiresKitchen,
      true,
    );

    const pendingPrintBeforeConfirmation = await app.inject({
      method: "GET",
      url: `/comandas/${comandaId}/print-document?kind=KITCHEN_PENDING`,
    });
    assert.equal(pendingPrintBeforeConfirmation.statusCode, 200);
    assert.deepEqual(
      pendingPrintBeforeConfirmation
        .json<{
          document: {
            items: Array<{
              additionals: Array<{ name: string; quantityPerUnit: number }>;
              productName: string;
              quantity: number;
              subtotalCents: number | null;
              unitPriceCents: number | null;
            }>;
          };
        }>()
        .document.items.map((item) => ({
          additionals: item.additionals.map(({ name, quantityPerUnit }) => ({
            name,
            quantityPerUnit,
          })),
          productName: item.productName,
          quantity: item.quantity,
          subtotalCents: item.subtotalCents,
          unitPriceCents: item.unitPriceCents,
        })),
      [
        {
          additionals: [],
          productName: "Hamburguer cozinha",
          quantity: 1,
          subtotalCents: null,
          unitPriceCents: null,
        },
        {
          additionals: [{ name: "Bacon cozinha", quantityPerUnit: 1 }],
          productName: "Hamburguer cozinha",
          quantity: 1,
          subtotalCents: null,
          unitPriceCents: null,
        },
      ],
    );
    const pendingPrintDocument = pendingPrintBeforeConfirmation.json<{
      document: {
        kind: string;
        tableNumber: number | null;
        totalCents: number | null;
      };
    }>().document;
    assert.equal(pendingPrintDocument.kind, "KITCHEN_PENDING");
    assert.equal(pendingPrintDocument.tableNumber, 91);
    assert.equal(pendingPrintDocument.totalCents, null);

    const firstConfirmation = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${kitchenItemId}/confirm`,
    });
    assert.equal(firstConfirmation.statusCode, 200);
    const firstTicket = await prisma.kitchenTicket.findFirstOrThrow({
      include: {
        items: {
          include: {
            configurations: {
              include: { additionals: true },
              orderBy: { configurationKey: "asc" },
            },
          },
        },
      },
      where: {
        confirmationKey: `CONFIRM:${kitchenItemId}:0:2`,
        establishmentId: integrationEstablishmentId,
      },
    });
    assert.equal(firstTicket.items[0].quantity, 2);
    assert.deepEqual(
      firstTicket.items[0].configurations
        .map((configuration) => ({
          additionals: configuration.additionals.map((entry) => ({
            additionalName: entry.additionalName,
            quantityPerUnit: entry.quantityPerUnit,
          })),
          quantity: configuration.quantity,
        }))
        .sort((left, right) => left.additionals.length - right.additionals.length),
      [
        { additionals: [], quantity: 1 },
        {
          additionals: [
            { additionalName: "Bacon cozinha", quantityPerUnit: 1 },
          ],
          quantity: 1,
        },
      ],
    );

    const confirmedPrint = await app.inject({
      method: "GET",
      url: `/comandas/${comandaId}/print-document?kind=CONFIRMED`,
    });
    assert.equal(confirmedPrint.statusCode, 200);
    assert.equal(
      confirmedPrint.json<{ document: { totalCents: number } }>().document
        .totalCents,
      5_300,
    );
    assert.equal(
      confirmedPrint
        .json<{ document: { items: Array<{ productName: string }> } }>()
        .document.items.every(
          ({ productName }) => productName === "Hamburguer cozinha",
        ),
      true,
    );

    const replay = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${kitchenItemId}/confirm`,
    });
    assert.equal(replay.statusCode, 200);
    assert.equal(
      await prisma.kitchenTicket.count({
        where: { comandaId, establishmentId: integrationEstablishmentId },
      }),
      1,
    );

    await app.inject({
      method: "POST",
      payload: { productId: kitchenProduct.id },
      url: `/comandas/${comandaId}/items`,
    });
    const concurrentResponses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/comandas/${comandaId}/items/${kitchenItemId}/confirm`,
      }),
      app.inject({
        method: "POST",
        url: `/comandas/${comandaId}/items/${kitchenItemId}/confirm`,
      }),
    ]);
    assert.ok(
      concurrentResponses.some(({ statusCode }) => statusCode === 200),
    );
    assert.equal(
      concurrentResponses.every(({ statusCode }) =>
        [200, 409, 503].includes(statusCode),
      ),
      true,
    );
    assert.equal(
      await prisma.kitchenTicket.count({
        where: { comandaId, establishmentId: integrationEstablishmentId },
      }),
      2,
    );
    const incrementalTicket = await prisma.kitchenTicket.findFirstOrThrow({
      include: { items: true },
      where: {
        confirmationKey: `CONFIRM:${kitchenItemId}:2:3`,
        establishmentId: integrationEstablishmentId,
      },
    });
    assert.equal(incrementalTicket.items[0].quantity, 1);

    const commonAdd = await app.inject({
      method: "POST",
      payload: { productId: commonProduct.id },
      url: `/comandas/${comandaId}/items`,
    });
    const commonItemId = commonAdd.json<{
      comanda: { items: Array<{ id: string; productId: string }> };
    }>().comanda.items.find(
      ({ productId }) => productId === commonProduct.id,
    )!.id;
    const commonConfirmation = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${commonItemId}/confirm`,
    });
    assert.equal(commonConfirmation.statusCode, 200);
    assert.equal(
      await prisma.kitchenTicket.count({
        where: { comandaId, establishmentId: integrationEstablishmentId },
      }),
      2,
    );

    const pendingPrintAfterConfirmation = await app.inject({
      method: "GET",
      url: `/comandas/${comandaId}/print-document?kind=KITCHEN_PENDING`,
    });
    assert.equal(pendingPrintAfterConfirmation.statusCode, 409);

    const completeConfirmedPrint = await app.inject({
      method: "GET",
      url: `/comandas/${comandaId}/print-document?kind=CONFIRMED`,
    });
    assert.equal(completeConfirmedPrint.statusCode, 200);
    assert.equal(
      completeConfirmedPrint.json<{ document: { totalCents: number } }>()
        .document.totalCents,
      8_300,
    );
    assert.equal(
      completeConfirmedPrint
        .json<{ document: { items: Array<{ productName: string }> } }>()
        .document.items.some(
          ({ productName }) => productName === "Agua cozinha",
        ),
      true,
    );

    const listResponse = await app.inject({
      method: "GET",
      url: "/kitchen/tickets",
    });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      listResponse
        .json<{ tickets: Array<{ id: string }> }>()
        .tickets.map(({ id }) => id),
      [firstTicket.id, incrementalTicket.id],
    );
    const sameStatusAuditCount = await prisma.auditLog.count({
      where: {
        action: "KITCHEN_TICKET_STATUS_CHANGED",
        resourceId: firstTicket.id,
      },
    });
    const sameStatus = await app.inject({
      method: "PATCH",
      payload: { status: "PENDING" },
      url: `/kitchen/tickets/${firstTicket.id}/status`,
    });
    assert.equal(sameStatus.statusCode, 200);
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "KITCHEN_TICKET_STATUS_CHANGED",
          resourceId: firstTicket.id,
        },
      }),
      sameStatusAuditCount,
    );
    for (const status of ["PREPARING", "READY", "DELIVERED"] as const) {
      const transition = await app.inject({
        method: "PATCH",
        payload: { status },
        url: `/kitchen/tickets/${firstTicket.id}/status`,
      });
      assert.equal(transition.statusCode, 200);
    }
    const invalidTransition = await app.inject({
      method: "PATCH",
      payload: { status: "DELIVERED" },
      url: `/kitchen/tickets/${incrementalTicket.id}/status`,
    });
    assert.equal(invalidTransition.statusCode, 409);
    const cancellation = await app.inject({
      method: "PATCH",
      payload: { status: "CANCELLED" },
      url: `/kitchen/tickets/${incrementalTicket.id}/status`,
    });
    assert.equal(cancellation.statusCode, 200);
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "KITCHEN_TICKET_CANCELLED",
          resourceId: incrementalTicket.id,
        },
      }),
      1,
    );

    const secondaryOwnerName = "Kitchen Secondary Owner";
    const secondaryOwnerPassword = "kitchen-secondary-password";
    await provisionEstablishment(prisma, {
      name: secondaryEstablishmentName,
      ownerName: secondaryOwnerName,
      ownerPassword: secondaryOwnerPassword,
    });
    secondaryApp = await createAuthenticatedApp(
      secondaryOwnerName,
      secondaryOwnerPassword,
    );
    const crossTenant = await secondaryApp.inject({
      method: "GET",
      url: `/kitchen/tickets/${incrementalTicket.id}`,
    });
    assert.equal(crossTenant.statusCode, 404);
    const crossTenantPrint = await secondaryApp.inject({
      method: "GET",
      url: `/comandas/${comandaId}/print-document?kind=CONFIRMED`,
    });
    assert.equal(crossTenantPrint.statusCode, 404);

    await app.inject({
      method: "POST",
      payload: { productId: kitchenProduct.id },
      url: `/comandas/${comandaId}/items`,
    });
    const collisionKey = `CONFIRM:${kitchenItemId}:3:4`;
    const collision = await prisma.kitchenTicket.create({
      data: {
        comandaId,
        confirmationKey: collisionKey,
        establishmentId: integrationEstablishmentId,
      },
    });
    const eventsBeforeRollback = await prisma.comandaEvent.count({
      where: { comandaId, type: "ITEM_CONFIRMED" },
    });
    const rollbackResponse = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${kitchenItemId}/confirm`,
    });
    assert.equal(rollbackResponse.statusCode, 503);
    assert.equal(
      (
        await prisma.comandaItem.findUniqueOrThrow({
          where: { id: kitchenItemId },
        })
      ).confirmedQuantity,
      3,
    );
    assert.equal(
      await prisma.inventoryOperation.count({
        where: {
          establishmentId: integrationEstablishmentId,
          requestId: collisionKey,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.comandaEvent.count({
        where: { comandaId, type: "ITEM_CONFIRMED" },
      }),
      eventsBeforeRollback,
    );
    await prisma.kitchenTicket.delete({ where: { id: collision.id } });

    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "KITCHEN_TICKET_CREATED",
          establishmentId: integrationEstablishmentId,
          resourceId: { in: [firstTicket.id, incrementalTicket.id] },
        },
      }),
      2,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "KITCHEN_TICKET_STATUS_CHANGED",
          resourceId: firstTicket.id,
        },
      }),
      3,
    );
  } finally {
    if (secondaryApp) {
      await secondaryApp.close();
    }
    await cleanupEstablishment(secondaryEstablishmentName);
    await app.close();
    await prisma.restaurantTable.update({
      data: { activeComandaId: null, status: "FREE" },
      where: { id: table.id },
    });
    const ticketIds = (
      await prisma.kitchenTicket.findMany({
        select: { id: true },
        where: { comandaId },
      })
    ).map(({ id }) => id);
    const ticketItemIds = (
      await prisma.kitchenTicketItem.findMany({
        select: { id: true },
        where: { kitchenTicketId: { in: ticketIds } },
      })
    ).map(({ id }) => id);
    const ticketConfigurationIds = (
      await prisma.kitchenTicketItemConfiguration.findMany({
        select: { id: true },
        where: { kitchenTicketItemId: { in: ticketItemIds } },
      })
    ).map(({ id }) => id);
    await prisma.kitchenTicketItemAdditional.deleteMany({
      where: {
        kitchenTicketItemConfigurationId: { in: ticketConfigurationIds },
      },
    });
    await prisma.kitchenTicketItemConfiguration.deleteMany({
      where: { id: { in: ticketConfigurationIds } },
    });
    await prisma.kitchenTicketItem.deleteMany({
      where: { id: { in: ticketItemIds } },
    });
    await prisma.kitchenTicket.deleteMany({ where: { id: { in: ticketIds } } });
    await prisma.inventoryOperation.deleteMany({ where: { comandaId } });
    const configurationIds = (
      await prisma.comandaItemConfiguration.findMany({
        select: { id: true },
        where: { comandaItem: { comandaId } },
      })
    ).map(({ id }) => id);
    await prisma.comandaItemAdditional.deleteMany({
      where: { configurationId: { in: configurationIds } },
    });
    await prisma.comandaItemConfiguration.deleteMany({
      where: { id: { in: configurationIds } },
    });
    await prisma.comandaItem.deleteMany({ where: { comandaId } });
    await prisma.comandaEvent.deleteMany({ where: { comandaId } });
    await prisma.comanda.deleteMany({ where: { id: comandaId } });
    await prisma.auditLog.deleteMany({
      where: {
        establishmentId: integrationEstablishmentId,
        OR: [
          { resourceId: { in: ticketIds } },
          { resourceId: { in: [comandaId, kitchenItemId].filter(Boolean) } },
        ],
      },
    });
    await prisma.productAdditional.deleteMany({
      where: { productId: kitchenProduct.id },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [kitchenProduct.id, commonProduct.id] } },
    });
    await prisma.additional.delete({ where: { id: additional.id } });
    await prisma.menuCategory.delete({ where: { id: category.id } });
    await prisma.restaurantTable.delete({ where: { id: table.id } });
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
          additionalTotalCents: number;
          confirmedQuantity: number;
          configurations: Array<{
            additionals: unknown[];
            configurationKey: string;
            confirmedQuantity: number;
            quantity: number;
          }>;
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
    const { additionalTotalCents, configurations, ...legacyFirstItem } = firstItem;
    assert.equal(additionalTotalCents, 0);
    assert.deepEqual(
      configurations.map(({ additionals, configurationKey, confirmedQuantity, quantity }) => ({
        additionals,
        configurationKey,
        confirmedQuantity,
        quantity,
      })),
      [{ additionals: [], configurationKey: "base", confirmedQuantity: 0, quantity: 1 }],
    );
    assert.deepEqual(legacyFirstItem, {
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

void test("concurrent confirmed cancellation applies stock and audit exactly once", async () => {
  const actor = await prisma.user.findFirstOrThrow({
    where: {
      establishmentId: integrationEstablishmentId,
      normalizedName: integrationUserName.toLocaleLowerCase("pt-BR"),
    },
  });
  const category = await prisma.menuCategory.create({
    data: {
      establishmentId: integrationEstablishmentId,
      name: "Concorrência de cancelamento",
      normalizedName: "concorrência de cancelamento",
    },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "INTEGRATION_CANCEL_RACE_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Produto cancelamento concorrente",
      priceCents: 500,
    },
  });
  const ingredient = await prisma.ingredient.create({
    data: {
      code: "INTEGRATION_CANCEL_RACE_INGREDIENT",
      establishmentId: integrationEstablishmentId,
      name: "Insumo cancelamento concorrente",
      unit: "UNIT",
    },
  });
  const stock = await prisma.inventoryStock.create({
    data: {
      establishmentId: integrationEstablishmentId,
      ingredientId: ingredient.id,
      minimumQuantity: 0,
      quantity: 10,
    },
  });
  await prisma.inventoryLot.create({
    data: {
      actorUserId: actor.id,
      code: "INTEGRATION_CANCEL_RACE_LOT",
      currentQuantity: 10,
      establishmentId: integrationEstablishmentId,
      initialQuantity: 10,
      origin: "PURCHASE",
      receivedAt: new Date(),
      stockId: stock.id,
      totalCostCents: 1_000,
    },
  });
  await prisma.productIngredient.create({
    data: {
      establishmentId: integrationEstablishmentId,
      ingredientId: ingredient.id,
      productId: product.id,
      quantity: 1,
    },
  });
  const table = await prisma.restaurantTable.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, number: 11 },
  });
  const app = await createAuthenticatedApp();

  try {
    const opened = await app.inject({
      method: "POST",
      url: `/tables/${table.id}/comandas`,
    });
    const comandaId = opened.json<{ comanda: Comanda }>().comanda.id;
    const addedItem = await app.inject({
      method: "POST",
      payload: { productId: product.id },
      url: `/comandas/${comandaId}/items`,
    });
    const itemId = addedItem.json<{ comanda: Comanda }>().comanda.items[0].id;
    await app.inject({
      method: "PATCH",
      payload: { delta: 1 },
      url: `/comandas/${comandaId}/items/${itemId}`,
    });
    const confirmed = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    const configurationId = confirmed.json<{ comanda: Comanda }>()
      .comanda.items[0].configurations[0].id;
    assert.equal(
      (await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
      8,
    );

    const requestIds = ["cancel-race-request-a", "cancel-race-request-b"];
    const responses = await Promise.all(
      requestIds.map((requestId) =>
        app.inject({
          method: "POST",
          payload: {
            disposition: "RETURN_TO_STOCK",
            quantity: 2,
            reason: "Cancelamento concorrente",
            requestId,
          },
          url: `/comandas/${comandaId}/items/${itemId}/configurations/${configurationId}/cancel`,
        }),
      ),
    );
    assert.deepEqual(
      responses.map(({ statusCode }) => statusCode).sort(),
      [200, 409],
      responses.map(({ body }) => body).join("\n"),
    );
    assert.equal(
      (await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
      10,
    );
    assert.deepEqual(
      await prisma.comandaItemConfiguration.findUniqueOrThrow({
        select: { confirmedQuantity: true, quantity: true },
        where: { id: configurationId },
      }),
      { confirmedQuantity: 0, quantity: 0 },
    );
    assert.deepEqual(
      await prisma.comandaItem.findUniqueOrThrow({
        select: { confirmedQuantity: true, quantity: true },
        where: { id: itemId },
      }),
      { confirmedQuantity: 0, quantity: 0 },
    );
    assert.equal(
      await prisma.comandaItemCancellation.count({
        where: { configurationId },
      }),
      1,
    );
    assert.equal(
      await prisma.inventoryOperation.count({
        where: {
          establishmentId: integrationEstablishmentId,
          requestId: { in: requestIds },
        },
      }),
      1,
    );
    assert.equal(
      await prisma.comandaEvent.count({
        where: { comandaId, itemId, type: "ITEM_CANCELLED" },
      }),
      1,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "COMANDA_ITEM_CANCELLED",
          establishmentId: integrationEstablishmentId,
          resourceId: configurationId,
        },
      }),
      1,
    );

    const cancelled = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/cancel`,
    });
    assert.equal(cancelled.statusCode, 200, cancelled.body);
  } finally {
    await app.close();
  }
});


void test("inventory consumption uses FEFO, ignores expired lots and keeps deficit idempotent", async () => {
  const actor = await prisma.user.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId, normalizedName: integrationUserName.toLocaleLowerCase("pt-BR") },
  });
  const category = await prisma.menuCategory.create({
    data: {
      establishmentId: integrationEstablishmentId,
      name: "Ficha técnica integração",
      normalizedName: "ficha técnica integração",
    },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "INTEGRATION_RECIPE_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Produto com receita",
      priceCents: 1_000,
    },
  });
  const ingredient = await prisma.ingredient.create({
    data: {
      code: "INTEGRATION_FLOUR",
      establishmentId: integrationEstablishmentId,
      name: "Farinha integração",
      unit: "GRAM",
    },
  });
  const stock = await prisma.inventoryStock.create({
    data: {
      establishmentId: integrationEstablishmentId,
      ingredientId: ingredient.id,
      minimumQuantity: 10,
      quantity: 70,
    },
  });
  const [expiredLot, firstLot, secondLot] = await Promise.all([
    prisma.inventoryLot.create({
      data: {
        actorUserId: actor.id,
        code: "EXPIRED",
        currentQuantity: 50,
        establishmentId: integrationEstablishmentId,
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        initialQuantity: 50,
        origin: "PURCHASE",
        receivedAt: new Date("2024-01-01T00:00:00.000Z"),
        stockId: stock.id,
        totalCostCents: 500,
      },
    }),
    prisma.inventoryLot.create({
      data: {
        actorUserId: actor.id,
        code: "FEFO-1",
        currentQuantity: 10,
        establishmentId: integrationEstablishmentId,
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        initialQuantity: 10,
        origin: "PURCHASE",
        receivedAt: new Date("2026-01-01T00:00:00.000Z"),
        stockId: stock.id,
        totalCostCents: 100,
      },
    }),
    prisma.inventoryLot.create({
      data: {
        actorUserId: actor.id,
        code: "FEFO-2",
        currentQuantity: 10,
        establishmentId: integrationEstablishmentId,
        expiresAt: new Date("2028-01-01T00:00:00.000Z"),
        initialQuantity: 10,
        origin: "PURCHASE",
        receivedAt: new Date("2026-02-01T00:00:00.000Z"),
        stockId: stock.id,
        totalCostCents: 100,
      },
    }),
  ]);
  await prisma.productIngredient.create({
    data: {
      establishmentId: integrationEstablishmentId,
      ingredientId: ingredient.id,
      productId: product.id,
      quantity: 6,
    },
  });
  const table = await prisma.restaurantTable.create({
    data: { establishmentId: integrationEstablishmentId, number: 90 },
  });
  const app = await createAuthenticatedApp();
  let comandaId = "";

  try {
    const opened = await app.inject({ method: "POST", url: `/tables/${table.id}/comandas` });
    comandaId = opened.json<{ comanda: { id: string } }>().comanda.id;
    const added = await app.inject({
      method: "POST",
      payload: { productId: product.id },
      url: `/comandas/${comandaId}/items`,
    });
    const itemId = added.json<{ comanda: { items: Array<{ id: string }> } }>().comanda.items[0].id;
    await app.inject({
      method: "PATCH",
      payload: { delta: 1 },
      url: `/comandas/${comandaId}/items/${itemId}`,
    });
    const confirmed = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(confirmed.statusCode, 200);
    assert.deepEqual(confirmed.json<{ inventoryWarnings: unknown[] }>().inventoryWarnings, []);
    assert.deepEqual(
      await prisma.inventoryLot.findMany({
        orderBy: { code: "asc" },
        select: { code: true, currentQuantity: true },
        where: { id: { in: [expiredLot.id, firstLot.id, secondLot.id] } },
      }),
      [
        { code: "EXPIRED", currentQuantity: 50 },
        { code: "FEFO-1", currentQuantity: 0 },
        { code: "FEFO-2", currentQuantity: 8 },
      ],
    );

    const retry = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(retry.statusCode, 200);
    assert.equal((await prisma.inventoryMovement.count({ where: { stockId: stock.id } })), 1);

    await prisma.productIngredient.update({
      data: { quantity: 100 },
      where: {
        establishmentId_productId_ingredientId: {
          establishmentId: integrationEstablishmentId,
          ingredientId: ingredient.id,
          productId: product.id,
        },
      },
    });
    await app.inject({
      method: "POST",
      payload: { productId: product.id },
      url: `/comandas/${comandaId}/items`,
    });
    const deficitResponse = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(deficitResponse.statusCode, 200);
    assert.deepEqual(
      deficitResponse.json<{ inventoryWarnings: Array<{ missingQuantity: number; type: string }> }>().inventoryWarnings.map(({ missingQuantity, type }) => ({ missingQuantity, type })),
      [{ missingQuantity: 92, type: "INSUFFICIENT_STOCK" }],
    );
    const finalStock = await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
    assert.equal(finalStock.quantity, -42);
    assert.equal(finalStock.deficitQuantity, 92);

    const configurationId = deficitResponse.json<{
      comanda: { items: Array<{ configurations: Array<{ id: string }> }> };
    }>().comanda.items[0].configurations[0].id;
    const returnCancellationPayload = {
      disposition: "RETURN_TO_STOCK",
      quantity: 1,
      reason: "Cancelamento com devolução",
      requestId: "inventory-return-request",
    } as const;
    const returned = await app.inject({
      method: "POST",
      payload: returnCancellationPayload,
      url: `/comandas/${comandaId}/items/${itemId}/configurations/${configurationId}/cancel`,
    });
    assert.equal(returned.statusCode, 200);
    const returnedReplay = await app.inject({
      method: "POST",
      payload: returnCancellationPayload,
      url: `/comandas/${comandaId}/items/${itemId}/configurations/${configurationId}/cancel`,
    });
    assert.equal(returnedReplay.statusCode, 200, returnedReplay.body);

    for (const payload of [
      { ...returnCancellationPayload, disposition: "LOSS" as const },
      { ...returnCancellationPayload, quantity: 2 },
      { ...returnCancellationPayload, reason: "Motivo diferente" },
    ]) {
      const collision = await app.inject({
        method: "POST",
        payload,
        url: `/comandas/${comandaId}/items/${itemId}/configurations/${configurationId}/cancel`,
      });
      assert.equal(collision.statusCode, 409, collision.body);
    }
    const sourceCollision = await app.inject({
      method: "POST",
      payload: returnCancellationPayload,
      url: `/comandas/${comandaId}/items/${itemId}/configurations/other-configuration/cancel`,
    });
    assert.equal(sourceCollision.statusCode, 409, sourceCollision.body);
    assert.equal(
      await prisma.comandaItemCancellation.count({
        where: { configurationId },
      }),
      1,
    );
    assert.equal(
      await prisma.inventoryOperation.count({
        where: {
          establishmentId: integrationEstablishmentId,
          requestId: returnCancellationPayload.requestId,
        },
      }),
      1,
    );

    const afterReturn = await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
    assert.equal(afterReturn.quantity, 58);
    assert.equal(afterReturn.deficitQuantity, 0);

    const loss = await app.inject({
      method: "POST",
      payload: {
        disposition: "LOSS",
        quantity: 1,
        reason: "Perda confirmada",
        requestId: "inventory-loss-request",
      },
      url: `/comandas/${comandaId}/items/${itemId}/configurations/${configurationId}/cancel`,
    });
    assert.equal(loss.statusCode, 200);
    assert.equal(
      (await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity,
      58,
    );
    assert.equal(
      await prisma.comandaItemCancellation.count({
        where: { configurationId },
      }),
      2,
    );
    const totalCancellationPayload = {
      disposition: "RETURN_TO_STOCK",
      reason: "Cancelamento total solicitado",
      requestId: "inventory-total-cancel-request",
    } as const;
    const totalCancellation = await app.inject({
      method: "POST",
      payload: totalCancellationPayload,
      url: `/comandas/${comandaId}/cancel`,
    });
    assert.equal(totalCancellation.statusCode, 200);
    assert.equal(
      totalCancellation.json<{ comanda: { status: string } }>().comanda.status,
      "CANCELLED",
    );
    assert.equal(
      (await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity,
      158,
    );
    const totalCancellationReplay = await app.inject({
      method: "POST",
      payload: totalCancellationPayload,
      url: `/comandas/${comandaId}/cancel`,
    });
    assert.equal(totalCancellationReplay.statusCode, 200);
    for (const payload of [
      { ...totalCancellationPayload, disposition: "LOSS" as const },
      { ...totalCancellationPayload, reason: "Outro motivo" },
    ]) {
      const collision = await app.inject({
        method: "POST",
        payload,
        url: `/comandas/${comandaId}/cancel`,
      });
      assert.equal(collision.statusCode, 409, collision.body);
    }
    const totalSourceCollision = await app.inject({
      method: "POST",
      payload: totalCancellationPayload,
      url: "/comandas/other-comanda/cancel",
    });
    assert.equal(totalSourceCollision.statusCode, 409, totalSourceCollision.body);
    assert.equal(
      await prisma.inventoryOperation.count({
        where: {
          establishmentId: integrationEstablishmentId,
          requestId: totalCancellationPayload.requestId,
        },
      }),
      1,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "COMANDA_CANCELLED",
          establishmentId: integrationEstablishmentId,
          resourceId: comandaId,
        },
      }),
      1,
    );

    const partialReplayAfterTotal = await app.inject({
      method: "POST",
      payload: returnCancellationPayload,
      url: `/comandas/${comandaId}/items/${itemId}/configurations/${configurationId}/cancel`,
    });
    assert.equal(partialReplayAfterTotal.statusCode, 200, partialReplayAfterTotal.body);

    assert.equal(
      (await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity,
      158,
    );
    assert.equal(
      await prisma.comandaItemCancellation.count({
        where: { configurationId },
      }),
      3,
    );
    assert.equal(
      (await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
      "FREE",
    );
  } finally {
    await app.close();
    await prisma.$transaction(async (transaction) => {
      await transaction.restaurantTable.update({
        data: { activeComandaId: null, status: "FREE" },
        where: { id: table.id },
      });
      const itemIds = comandaId
        ? (await transaction.comandaItem.findMany({
            select: { id: true },
            where: { comandaId },
          })).map(({ id }) => id)
        : [];
      const configurationIds = (await transaction.comandaItemConfiguration.findMany({
        select: { id: true },
        where: { comandaItemId: { in: itemIds } },
      })).map(({ id }) => id);
      await transaction.comandaItemCancellation.deleteMany({
        where: { configurationId: { in: configurationIds } },
      });
      await transaction.comandaItemAdditional.deleteMany({
        where: { configurationId: { in: configurationIds } },
      });
      await transaction.comandaItemConfiguration.deleteMany({
        where: { id: { in: configurationIds } },
      });
      await transaction.inventoryMovementLot.deleteMany({
        where: { movement: { stockId: stock.id } },
      });
      await transaction.inventoryMovement.deleteMany({ where: { stockId: stock.id } });
      await transaction.inventoryOperation.deleteMany({
        where: {
          OR: [
            { comandaId },
            { sourceId: { in: [...itemIds, ...configurationIds] } },
          ],
        },
      });
      if (comandaId) {
        await transaction.comandaItem.deleteMany({ where: { comandaId } });
        await transaction.comandaEvent.deleteMany({ where: { comandaId } });
        await transaction.comanda.deleteMany({ where: { id: comandaId } });
      }
      await transaction.productIngredient.deleteMany({ where: { productId: product.id } });
      await transaction.product.delete({ where: { id: product.id } });
      await transaction.menuCategory.delete({ where: { id: category.id } });
      await transaction.inventoryLot.deleteMany({ where: { stockId: stock.id } });
      await transaction.inventoryStock.delete({ where: { id: stock.id } });
      await transaction.ingredient.delete({ where: { id: ingredient.id } });
      await transaction.restaurantTable.delete({ where: { id: table.id } });
      await transaction.auditLog.deleteMany({
        where: {
          establishmentId: integrationEstablishmentId,
          resourceId: { in: [...itemIds, comandaId].filter(Boolean) },
        },
      });
    });
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
    await provisionUser(prisma, { establishmentName: integrationEstablishmentName, name: "Credit Restricted Waiter", password: integrationUserPassword, roleCodes: ["WAITER"] });
    const waiterApp = await createAuthenticatedApp("Credit Restricted Waiter", integrationUserPassword);
    try {
      const beforeAudit = await prisma.auditLog.count({ where: { establishmentId: integrationEstablishmentId } });
      for (const payments of [[], [{ amountCents: 500, method: "PIX" }]]) {
        const forbidden = await waiterApp.inject({ method: "POST", url: `/comandas/${mixed.comandaId}/close`, payload: { customerId, payments } });
        assert.equal(forbidden.statusCode, 403, forbidden.body);
      }
      assert.equal(await prisma.payment.count({ where: { comandaId: mixed.comandaId } }), 0);
      assert.equal(await prisma.creditOrder.count({ where: { comandaId: mixed.comandaId } }), 0);
      assert.equal(await prisma.auditLog.count({ where: { establishmentId: integrationEstablishmentId } }), beforeAudit);
      const unchanged = await prisma.restaurantTable.findUniqueOrThrow({ where: { id: table.id } });
      assert.equal(unchanged.activeComandaId, mixed.comandaId);
    } finally { await waiterApp.close(); }

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
      number: 9_001,
      openedAt: new Date("2031-04-10T12:00:00.000Z"),
      openedDate: new Date("2031-04-10T00:00:00.000Z"),
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
      number: 9_002,
      openedAt: new Date("2031-04-10T11:00:00.000Z"),
      openedDate: new Date("2031-04-10T00:00:00.000Z"),
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
      number: 9_003,
      openedAt: new Date("2031-04-11T15:00:00.000Z"),
      openedDate: new Date("2031-04-11T00:00:00.000Z"),
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

void test("delivery orders reuse the catalog, checkout, courier settlement and statements", async () => {
  const hamburger = await prisma.product.findFirstOrThrow({
    where: {
      code: "CLASSIC_HAMBURGER",
      establishmentId: integrationEstablishmentId,
    },
  });
  await prisma.product.update({
    data: { requiresKitchen: true },
    where: { id: hamburger.id },
  });
  const app = await createAuthenticatedApp();
  let comandaId = "";
  let courierId = "";
  let dayId = "";
  let itemId = "";
  let kitchenTicketId = "";
  let orderId = "";
  let paymentId = "";

  try {
    const createResponse = await app.inject({
      method: "POST",
      payload: {
        address: "Rua do Pedido, 74",
        customerName: "Cliente Delivery",
        feeCents: 500,
        phone: "11999999999",
      },
      url: "/delivery/orders",
    });
    assert.equal(createResponse.statusCode, 201);
    const created = createResponse.json<{
      order: {
        comandaId: string;
        id: string;
        itemCount: number;
        status: string;
        totalCents: number;
      };
    }>().order;
    comandaId = created.comandaId;
    orderId = created.id;
    assert.equal(created.status, "NEW");
    assert.equal(created.itemCount, 0);
    assert.equal(created.totalCents, 500);

    const emptyCheckoutResponse = await app.inject({
      method: "POST",
      payload: { payments: [{ amountCents: 500, method: "PIX" }] },
      url: `/comandas/${comandaId}/close`,
    });
    assert.equal(emptyCheckoutResponse.statusCode, 409);

    const addResponse = await app.inject({
      method: "POST",
      payload: { productId: hamburger.id },
      url: `/comandas/${comandaId}/items`,
    });
    assert.equal(addResponse.statusCode, 200);
    itemId = addResponse.json<{
      comanda: { items: Array<{ id: string }> };
    }>().comanda.items[0]?.id ?? "";
    assert.ok(itemId);

    const pendingStatusResponse = await app.inject({
      method: "POST",
      payload: { status: "PREPARING" },
      url: `/delivery/orders/${orderId}/status`,
    });
    assert.equal(pendingStatusResponse.statusCode, 409);

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${itemId}/confirm`,
    });
    assert.equal(confirmResponse.statusCode, 200);
    const kitchenTicket = await prisma.kitchenTicket.findFirstOrThrow({
      where: {
        confirmationKey: `CONFIRM:${itemId}:0:1`,
        establishmentId: integrationEstablishmentId,
      },
    });
    kitchenTicketId = kitchenTicket.id;
    const kitchenTicketResponse = await app.inject({
      method: "GET",
      url: `/kitchen/tickets/${kitchenTicket.id}`,
    });
    assert.equal(kitchenTicketResponse.statusCode, 200);
    assert.equal(
      kitchenTicketResponse.json<{ ticket: { table: unknown } }>().ticket.table,
      null,
    );

    for (const status of ["PREPARING", "READY"] as const) {
      const statusResponse = await app.inject({
        method: "POST",
        payload: { status },
        url: `/delivery/orders/${orderId}/status`,
      });
      assert.equal(statusResponse.statusCode, 200);
    }

    const courierResponse = await app.inject({
      method: "POST",
      payload: { name: "Entregador do pedido" },
      url: "/delivery/couriers",
    });
    assert.equal(courierResponse.statusCode, 201);
    courierId = courierResponse.json<{
      courier: { id: string };
    }>().courier.id;

    const openDayResponse = await app.inject({
      method: "POST",
      payload: { dailyRateCents: 8_000 },
      url: `/delivery/couriers/${courierId}/days`,
    });
    assert.equal(openDayResponse.statusCode, 201);
    dayId = openDayResponse.json<{ day: { id: string } }>().day.id;

    const dispatchResponse = await app.inject({
      method: "POST",
      payload: { dayId, status: "OUT_FOR_DELIVERY" },
      url: `/delivery/orders/${orderId}/status`,
    });
    assert.equal(dispatchResponse.statusCode, 200);

    const prematureSettlementResponse = await app.inject({
      method: "POST",
      url: `/delivery/days/${dayId}/close`,
    });
    assert.equal(prematureSettlementResponse.statusCode, 409);

    const checkoutResponse = await app.inject({
      method: "POST",
      payload: { payments: [{ amountCents: 1_599, method: "PIX" }] },
      url: `/comandas/${comandaId}/close`,
    });
    assert.equal(checkoutResponse.statusCode, 200);
    const checkedOut = checkoutResponse.json<{
      comanda: {
        payments: Array<{ id: string; origin: string }>;
        status: string;
        totalCents: number;
      };
    }>().comanda;
    assert.equal(checkedOut.status, "CLOSED");
    assert.equal(checkedOut.totalCents, 1_599);
    assert.equal(checkedOut.payments[0]?.origin, "DELIVERY_CHECKOUT");
    paymentId = checkedOut.payments[0]?.id ?? "";

    const deliveredResponse = await app.inject({
      method: "POST",
      payload: { status: "DELIVERED" },
      url: `/delivery/orders/${orderId}/status`,
    });
    assert.equal(deliveredResponse.statusCode, 200);

    const dayResponse = await app.inject({
      method: "GET",
      url: `/delivery/days/${dayId}`,
    });
    assert.equal(dayResponse.statusCode, 200);
    const day = dayResponse.json<{
      day: {
        deliveryCount: number;
        feesTotalCents: number;
        payoutCents: number;
        salesTotalCents: number;
      };
    }>().day;
    assert.deepEqual(
      {
        deliveryCount: day.deliveryCount,
        feesTotalCents: day.feesTotalCents,
        payoutCents: day.payoutCents,
        salesTotalCents: day.salesTotalCents,
      },
      {
        deliveryCount: 1,
        feesTotalCents: 500,
        payoutCents: 8_500,
        salesTotalCents: 1_599,
      },
    );

    const settlementResponse = await app.inject({
      method: "POST",
      url: `/delivery/days/${dayId}/close`,
    });
    assert.equal(settlementResponse.statusCode, 200);
    assert.equal(
      settlementResponse.json<{ day: { settlementPaidCents: number } }>().day
        .settlementPaidCents,
      8_500,
    );

    const today = Object.fromEntries(
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
        year: "numeric",
      })
        .formatToParts(new Date())
        .map((part) => [part.type, part.value]),
    );
    const dateKey = `${today.year}-${today.month}-${today.day}`;
    const statementResponse = await app.inject({
      method: "GET",
      url: `/statements?from=${dateKey}&to=${dateKey}`,
    });
    assert.equal(statementResponse.statusCode, 200);
    const deliveryEntry = statementResponse
      .json<{
        statement: {
          entries: Array<{
            comandaId: string | null;
            deliveryFeeCents: number | null;
            event: string;
            origin: string;
            receivedCents: number;
            soldCents: number;
          }>;
        };
      }>()
      .statement.entries.find((entry) => entry.comandaId === comandaId);
    assert.ok(deliveryEntry);
    assert.deepEqual(
      {
        comandaId: deliveryEntry.comandaId,
        deliveryFeeCents: deliveryEntry.deliveryFeeCents,
        event: deliveryEntry.event,
        origin: deliveryEntry.origin,
        receivedCents: deliveryEntry.receivedCents,
        soldCents: deliveryEntry.soldCents,
      },
      {
        comandaId,
        deliveryFeeCents: 500,
        event: "DELIVERY_RECORDED",
        origin: "DELIVERY",
        receivedCents: 1_599,
        soldCents: 1_599,
      },
    );

    assert.equal(
      await prisma.auditLog.count({
        where: {
          action: "DELIVERY_ORDER_STATUS_CHANGED",
          establishmentId: integrationEstablishmentId,
          resourceId: orderId,
        },
      }),
      4,
    );
  } finally {
    await app.close();
    if (comandaId) {
      await prisma.$transaction(async (transaction) => {
        if (paymentId) {
          await transaction.paymentAllocation.deleteMany({
            where: { paymentId },
          });
        }
        await transaction.payment.deleteMany({ where: { comandaId } });
        if (orderId) {
          await transaction.deliveryOrder.deleteMany({ where: { id: orderId } });
        }
        await transaction.inventoryOperation.updateMany({
          data: { comandaId: null },
          where: { comandaId },
        });
        const kitchenTicketIds = (
          await transaction.kitchenTicket.findMany({
            select: { id: true },
            where: { comandaId },
          })
        ).map(({ id }) => id);
        const kitchenTicketItemIds = (
          await transaction.kitchenTicketItem.findMany({
            select: { id: true },
            where: { kitchenTicketId: { in: kitchenTicketIds } },
          })
        ).map(({ id }) => id);
        const kitchenTicketConfigurationIds = (
          await transaction.kitchenTicketItemConfiguration.findMany({
            select: { id: true },
            where: { kitchenTicketItemId: { in: kitchenTicketItemIds } },
          })
        ).map(({ id }) => id);
        await transaction.kitchenTicketItemAdditional.deleteMany({
          where: {
            kitchenTicketItemConfigurationId: {
              in: kitchenTicketConfigurationIds,
            },
          },
        });
        await transaction.kitchenTicketItemConfiguration.deleteMany({
          where: { id: { in: kitchenTicketConfigurationIds } },
        });
        await transaction.kitchenTicketItem.deleteMany({
          where: { id: { in: kitchenTicketItemIds } },
        });
        await transaction.kitchenTicket.deleteMany({
          where: { id: { in: kitchenTicketIds } },
        });
        const configurationIds = await transaction.comandaItemConfiguration.findMany({
          select: { id: true },
          where: { comandaItem: { comandaId } },
        });
        await transaction.comandaItemCancellation.deleteMany({
          where: { configurationId: { in: configurationIds.map(({ id }) => id) } },
        });
        await transaction.comandaItemAdditional.deleteMany({
          where: { configurationId: { in: configurationIds.map(({ id }) => id) } },
        });
        await transaction.comandaItemConfiguration.deleteMany({
          where: { id: { in: configurationIds.map(({ id }) => id) } },
        });
        await transaction.comandaItem.deleteMany({ where: { comandaId } });
        await transaction.comandaEvent.deleteMany({ where: { comandaId } });
        await transaction.comanda.deleteMany({ where: { id: comandaId } });
        if (dayId) {
          await transaction.deliveryDay.deleteMany({ where: { id: dayId } });
        }
        if (courierId) {
          await transaction.deliveryCourier.deleteMany({ where: { id: courierId } });
        }
        await transaction.auditLog.deleteMany({
          where: {
            establishmentId: integrationEstablishmentId,
            resourceId: {
              in: [
                comandaId,
                courierId,
                dayId,
                itemId,
                kitchenTicketId,
                orderId,
                paymentId,
              ].filter(Boolean),
            },
          },
        });
      });
    }
    await prisma.product.update({
      data: { requiresKitchen: hamburger.requiresKitchen },
      where: { id: hamburger.id },
    });
  }
});

void test("delivery lifecycle is persisted, audited and reconciled in statements", async () => {
  const operator = await prisma.user.findUniqueOrThrow({
    where: {
      normalizedName: integrationUserName.toLocaleLowerCase("pt-BR"),
    },
  });
  const app = await createAuthenticatedApp();
  let courierId = "";
  let dayId = "";

  try {
    const courierResponse = await app.inject({
      method: "POST",
      payload: { name: "  Entregador de integração  " },
      url: "/delivery/couriers",
    });
    assert.equal(courierResponse.statusCode, 201);
    const courier = courierResponse.json<{
      courier: { id: string; name: string };
    }>().courier;
    courierId = courier.id;
    assert.equal(courier.name, "Entregador de integração");

    const openResponse = await app.inject({
      method: "POST",
      payload: { dailyRateCents: 8_000 },
      url: `/delivery/couriers/${courierId}/days`,
    });
    assert.equal(openResponse.statusCode, 201);
    dayId = openResponse.json<{ day: { id: string } }>().day.id;

    await assert.rejects(
      prisma.delivery.create({
        data: {
          actorUserId: operator.id,
          address: "Rua inválida, 1",
          customerName: "Cliente inválido",
          dayId,
          establishmentId: integrationEstablishmentId,
          feeCents: 1_001,
          paymentMethod: "PIX",
          totalCents: 1_000,
        },
      }),
    );
    assert.equal(
      await prisma.delivery.count({
        where: { dayId },
      }),
      0,
    );

    const deliveryResponse = await app.inject({
      method: "POST",
      payload: {
        address: "Rua das Flores, 120",
        customerName: "Marina",
        feeCents: 500,
        paymentMethod: "PIX",
        products: "Pizza calabresa",
        totalCents: 5_000,
      },
      url: `/delivery/days/${dayId}/deliveries`,
    });
    assert.equal(deliveryResponse.statusCode, 201);
    const deliveryId = deliveryResponse.json<{
      day: { deliveries: Array<{ id: string }> };
    }>().day.deliveries[0]?.id;
    assert.ok(deliveryId);

    const expenseResponse = await app.inject({
      method: "POST",
      payload: { amountCents: 1_000, description: "Combustível" },
      url: `/delivery/days/${dayId}/expenses`,
    });
    assert.equal(expenseResponse.statusCode, 201);

    const dayResponse = await app.inject({
      method: "GET",
      url: `/delivery/days/${dayId}`,
    });
    assert.equal(dayResponse.statusCode, 200);
    const openDay = dayResponse.json<{
      day: {
        deliveryCount: number;
        expensesTotalCents: number;
        feesTotalCents: number;
        payoutCents: number;
        recordedBy?: { id: string };
        salesTotalCents: number;
      };
    }>().day;
    assert.equal(openDay.deliveryCount, 1);
    assert.equal(openDay.salesTotalCents, 5_000);
    assert.equal(openDay.feesTotalCents, 500);
    assert.equal(openDay.expensesTotalCents, 1_000);
    assert.equal(openDay.payoutCents, 7_500);

    const closeResponse = await app.inject({
      method: "POST",
      url: `/delivery/days/${dayId}/close`,
    });
    assert.equal(closeResponse.statusCode, 200);
    const closedDay = closeResponse.json<{
      day: {
        settlementPaidCents: number | null;
        status: string;
      };
    }>().day;
    assert.equal(closedDay.status, "CLOSED");
    assert.equal(closedDay.settlementPaidCents, 7_500);

    await prisma.delivery.update({
      data: { deliveredAt: new Date("2032-01-15T15:00:00.000Z") },
      where: { id: deliveryId },
    });
    const statementResponse = await app.inject({
      method: "GET",
      url: "/statements?from=2032-01-15&to=2032-01-15",
    });
    assert.equal(statementResponse.statusCode, 200);
    const statement = statementResponse.json<{
      statement: {
        entries: Array<{
          deliveryAddress: string | null;
          deliveryFeeCents: number | null;
          event: string;
          origin: string;
          receivedCents: number;
        }>;
      };
    }>().statement;
    assert.equal(statement.entries.length, 1);
    assert.match(statement.entries[0]?.deliveryAddress ?? "", /Flores/);
    assert.deepEqual(
      statement.entries.map((entry) => ({
        deliveryFeeCents: entry.deliveryFeeCents,
        event: entry.event,
        origin: entry.origin,
        receivedCents: entry.receivedCents,
      })),
      [
        {
          deliveryFeeCents: 500,
          event: "DELIVERY_RECORDED",
          origin: "DELIVERY",
          receivedCents: 5_000,
        },
      ],
    );

    const auditActions = await prisma.auditLog.groupBy({
      _count: { _all: true },
      by: ["action"],
      where: {
        action: {
          in: [
            "DELIVERY_COURIER_CREATED",
            "DELIVERY_DAY_OPENED",
            "DELIVERY_RECORDED",
            "DELIVERY_EXPENSE_RECORDED",
            "DELIVERY_DAY_CLOSED",
          ],
        },
        establishmentId: integrationEstablishmentId,
        userId: operator.id,
      },
    });
    assert.equal(
      auditActions.reduce((total, action) => total + action._count._all, 0),
      5,
    );
  } finally {
    await app.close();
    if (courierId) {
      await prisma.$transaction(async (transaction) => {
        await transaction.deliveryExpense.deleteMany({ where: { dayId } });
        await transaction.delivery.deleteMany({ where: { dayId } });
        await transaction.deliveryDay.deleteMany({ where: { courierId } });
        await transaction.deliveryCourier.deleteMany({
          where: { id: courierId },
        });
        await transaction.auditLog.deleteMany({
          where: {
            establishmentId: integrationEstablishmentId,
            resourceType: {
              in: [
                "DELIVERY",
                "DELIVERY_COURIER",
                "DELIVERY_DAY",
                "DELIVERY_EXPENSE",
              ],
            },
          },
        });
      });
    }
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
  const kitchenPermissionsByRole = new Map(
    (
      await prisma.role.findMany({
        orderBy: { code: "asc" },
        select: {
          code: true,
          permissions: {
            select: { permission: { select: { code: true } } },
            where: {
              permission: {
                code: { in: ["kitchen.read", "kitchen.write"] },
              },
            },
          },
        },
        where: { code: { in: ["KITCHEN", "MANAGER", "OWNER", "WAITER"] } },
      })
    ).map((role) => [
      role.code,
      role.permissions.map(({ permission }) => permission.code).sort(),
    ]),
  );
  for (const roleCode of ["KITCHEN", "MANAGER", "OWNER"]) {
    assert.deepEqual(kitchenPermissionsByRole.get(roleCode), [
      "kitchen.read",
      "kitchen.write",
    ]);
  }
  assert.deepEqual(kitchenPermissionsByRole.get("WAITER"), []);

  const primaryApp = await createAuthenticatedApp();
  const secondaryApp = await createAuthenticatedApp(
    secondaryOwnerName,
    secondaryOwnerPassword,
  );
  let primaryDeliveryCourierId = "";

  try {
    const primaryCourierResponse = await primaryApp.inject({
      method: "POST",
      payload: { name: "Entregador isolado" },
      url: "/delivery/couriers",
    });
    assert.equal(primaryCourierResponse.statusCode, 201);
    primaryDeliveryCourierId = primaryCourierResponse.json<{
      courier: { id: string };
    }>().courier.id;

    const crossTenantCourierResponse = await secondaryApp.inject({
      method: "GET",
      url: `/delivery/couriers/${primaryDeliveryCourierId}`,
    });
    assert.equal(crossTenantCourierResponse.statusCode, 404);

    await assert.rejects(
      prisma.deliveryDay.create({
        data: {
          courierId: primaryDeliveryCourierId,
          dailyRateCents: 8_000,
          establishmentId: secondary.id,
          openedByUserId: secondary.users[0].id,
        },
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003",
    );

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
    const primaryInventoryIds = primaryInventoryResponse
      .json<{ inventory: { id: string }[] }>()
      .inventory.map(({ id }) => id);
    const secondaryInventoryIds = secondaryInventoryResponse
      .json<{ inventory: { id: string }[] }>()
      .inventory.map(({ id }) => id);
    assert.ok(primaryInventoryIds.includes(primaryStockId));
    assert.ok(!primaryInventoryIds.includes(secondaryStockId));
    assert.ok(secondaryInventoryIds.includes(secondaryStockId));
    assert.ok(!secondaryInventoryIds.includes(primaryStockId));

    const entryResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: 1_000,
        reason: "Compra de teste",
        requestId: "legacy-adjustment-request",
        type: "ADJUSTMENT",
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
        requestId: "legacy-exit-request",
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
    const replayedExitResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: -250,
        reason: "Consumo de teste",
        requestId: "legacy-exit-request",
        type: "EXIT",
      },
      url: `/inventory/${primaryStockId}/movements`,
    });
    assert.equal(replayedExitResponse.statusCode, 200);
    assert.equal(
      replayedExitResponse.json<{ replayed: boolean }>().replayed,
      true,
    );
    assert.equal(
      (await prisma.inventoryStock.findUniqueOrThrow({
        where: { id: primaryStockId },
      })).quantity,
      750,
    );

    const negativeBalanceResponse = await primaryApp.inject({
      method: "POST",
      payload: {
        quantityDelta: -751,
        reason: "Consumo invalido",
        requestId: "legacy-negative-request",
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
          requestId: "cross-tenant-request",
          type: "ADJUSTMENT",
      },
      url: `/inventory/${primaryStockId}/movements`,
    });
    assert.equal(crossTenantMovementResponse.statusCode, 404);

    await assert.rejects(
      prisma.inventoryMovement.create({
        data: {
          actorUserId: secondary.users[0].id,
          balanceAfter: 10,
          balanceBefore: 0,
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
    if (primaryDeliveryCourierId) {
      await prisma.deliveryCourier.deleteMany({
        where: { id: primaryDeliveryCourierId },
      });
    }
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
  const resetProduct = await prisma.product.findFirstOrThrow({
    where: tenantFilter,
  });
  const resetComanda = await prisma.comanda.create({
    data: {
      establishmentId: integrationEstablishmentId,
      name: "Reset cozinha",
      number: 9_999,
      openedAt: new Date("2035-01-01T12:00:00.000Z"),
      openedDate: new Date("2035-01-01T00:00:00.000Z"),
    },
  });
  const resetItem = await prisma.comandaItem.create({
    data: {
      comandaId: resetComanda.id,
      confirmedQuantity: 1,
      establishmentId: integrationEstablishmentId,
      productId: resetProduct.id,
      productName: resetProduct.name,
      quantity: 1,
      requiresKitchen: true,
      unitPriceCents: resetProduct.priceCents,
    },
  });
  const resetConfiguration = await prisma.comandaItemConfiguration.create({
    data: {
      comandaItemId: resetItem.id,
      configurationKey: "reset-configuration",
      confirmedQuantity: 1,
      establishmentId: integrationEstablishmentId,
      quantity: 1,
    },
  });
  await prisma.kitchenTicket.create({
    data: {
      comandaId: resetComanda.id,
      confirmationKey: `RESET:${resetItem.id}`,
      establishmentId: integrationEstablishmentId,
      items: {
        create: {
          comandaItemId: resetItem.id,
          configurations: {
            create: {
              additionals: {
                create: {
                          additionalId: "reset-additional",
                          additionalName: "Adicional do reset",
                          quantityPerUnit: 1,
                },
              },
              configurationKey: "reset-configuration",
              quantity: 1,
              sourceConfigurationId: resetConfiguration.id,
            },
          },
          productId: resetProduct.id,
          productName: resetProduct.name,
          quantity: 1,
        },
      },
    },
  });

  try {
    await resetOperationalData(prisma, integrationEstablishmentId);

    assert.equal(await prisma.comanda.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.comandaEvent.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.comandaItem.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.kitchenTicket.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.kitchenTicketItem.count({ where: tenantFilter }), 0);
    assert.equal(
      await prisma.kitchenTicketItemConfiguration.count({ where: tenantFilter }),
      0,
    );
    assert.equal(
      await prisma.kitchenTicketItemAdditional.count({ where: tenantFilter }),
      0,
    );
    assert.equal(await prisma.creditCustomer.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.creditOrder.count({ where: tenantFilter }), 0);
    assert.equal(await prisma.deliveryOrder.count({ where: tenantFilter }), 0);
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

void test("admin users: owner creates roles with tenant isolation and atomic audit", async () => {
  const app = await createAuthenticatedApp();
  const password = "admin-users-test-password";
  try {
    const list = await app.inject({ method: "GET", url: "/admin/users" });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.json<AdminUsers>().roles.map((role: { code: string }) => role.code), ["OWNER", "MANAGER", "WAITER", "KITCHEN"]);
    const owner = await prisma.user.findUniqueOrThrow({ where: { normalizedName: integrationUserName.toLowerCase() } });
    for (const roleCode of ["OWNER", "MANAGER", "WAITER", "KITCHEN"]) {
      const name = `Admin Integration ${roleCode}`;
      const response = await app.inject({ method: "POST", url: "/admin/users", payload: { name, password, roleCode } });
      assert.equal(response.statusCode, 201, response.body);
      const { user } = response.json<{ user: AdminUser }>();
      assert.deepEqual(Object.keys(user).sort(), ['active', 'canReassign', 'id', 'name', 'permissions', 'roleVersion', 'roles'].sort());
      assert.equal(user.active, true);
      assert.equal(user.roles.length, 1);
      assert.equal(user.roles[0].code, roleCode);
      const persisted = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { localRole: true } });
      assert.equal(persisted.establishmentId, integrationEstablishmentId);
      assert.notEqual(persisted.passwordHash, password);
      assert.equal(persisted.localRole.code, roleCode);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "USER_CREATED", resourceId: user.id } });
      assert.equal(audit.userId, owner.id);
      assert.equal(audit.establishmentId, integrationEstablishmentId);
      assert.ok(!JSON.stringify(audit).includes(password));
      assert.ok(!JSON.stringify(audit).includes(persisted.passwordHash));
      const login = await app.inject({ method: "POST", url: "/auth/login", payload: { name, password } });
      assert.equal(login.statusCode, 200);
      const token = login.json<{ session: { token: string } }>().session.token;
      const creditHeaders = { authorization: `Bearer ${token}` };
      const creditList = await app.inject({ method: "GET", url: "/credit-customers", headers: creditHeaders });
      assert.equal(creditList.statusCode, ["OWNER", "MANAGER"].includes(roleCode) ? 200 : 403);
      if (["OWNER", "MANAGER"].includes(roleCode)) {
        const createdCredit = await app.inject({ method: "POST", url: "/credit-customers", headers: creditHeaders, payload: { name: `Allowed Credit ${roleCode}` } });
        assert.equal(createdCredit.statusCode, 201, createdCredit.body);
      }
      if (["WAITER", "KITCHEN"].includes(roleCode)) {
        const before = await prisma.creditCustomer.count({ where: { establishmentId: integrationEstablishmentId } });
        const denied = await app.inject({ method: "POST", url: "/credit-customers", headers: creditHeaders, payload: { name: "Forbidden Credit" } });
        assert.equal(denied.statusCode, 403);
        assert.equal(await prisma.creditCustomer.count({ where: { establishmentId: integrationEstablishmentId } }), before);
      }
      if (roleCode !== "OWNER") {
        for (const method of ["GET", "POST"] as const) {
          const forbidden = await app.inject({ method, url: "/admin/users", headers: { authorization: `Bearer ${token}` }, ...(method === "POST" ? { payload: { name: "Forbidden Creation", password, roleCode: "OWNER" } } : {}) });
          assert.equal(forbidden.statusCode, 403);
        }
      }
    }
    for (const method of ["GET", "POST"] as const) {
      const unauthenticated = await app.inject({ method, url: "/admin/users", headers: { authorization: "" }, ...(method === "POST" ? { payload: {} } : {}) });
      assert.equal(unauthenticated.statusCode, 401);
    }
    const duplicate = await app.inject({ method: "POST", url: "/admin/users", payload: { name: "  ADMIN   INTEGRATION waiter  ", password, roleCode: "WAITER" } });
    assert.equal(duplicate.statusCode, 409);
    for (const invalid of [
      { name: "A", password, roleCode: "WAITER" },
      { name: "Invalid Name", password: "short", roleCode: "WAITER" },
      { name: "Invalid Name", password: "x".repeat(129), roleCode: "WAITER" },
      { name: "Invalid Name", password, roleCode: "CASHIER" },
      { name: "Invalid Name", password, roleCode: ["WAITER", "OWNER"] },
      { name: "Invalid Name", password, roleCode: "WAITER", establishmentId: "another-establishment" },
    ]) {
      const response = await app.inject({ method: "POST", url: "/admin/users", payload: invalid });
      assert.equal(response.statusCode, 400);
    }
    await provisionEstablishment(prisma, { name: secondaryEstablishmentName, ownerName: "Admin Secondary Owner", ownerPassword: password });
    const otherApp = await createAuthenticatedApp("Admin Secondary Owner", password);
    try {
      const otherList = await otherApp.inject({ method: "GET", url: "/admin/users" });
      assert.equal(otherList.statusCode, 200);
      assert.equal(otherList.json<AdminUsers>().users.length, 1);
      assert.equal(otherList.json<AdminUsers>().users[0].name, "Admin Secondary Owner");
      const conflicting = await otherApp.inject({ method: "POST", url: "/admin/users", payload: { name: "Admin Integration WAITER", password, roleCode: "WAITER" } });
      assert.equal(conflicting.statusCode, 409);
      assert.ok(!conflicting.body.includes(integrationEstablishmentId));
      // A different establishment's audit actor violates the real composite FK.
      const persistence = createPersistence();
      try {
        const session = await persistence.auth.login("Admin Secondary Owner", password);
        await assert.rejects(persistence.users.create({ ...session.user, establishment: { id: integrationEstablishmentId, name: "Integration Bistro" } }, { name: "Atomic Failed User", password, roleCode: "WAITER" }));
        assert.equal(await prisma.user.count({ where: { normalizedName: "atomic failed user" } }), 0);
      } finally { await persistence.database.close(); }
    } finally { await otherApp.close(); await cleanupEstablishment(secondaryEstablishmentName); }
    const concurrent = await Promise.all([1, 2].map(() => app.inject({ method: "POST", url: "/admin/users", payload: { name: "Concurrent Admin User", password, roleCode: "WAITER" } })));
    assert.deepEqual(concurrent.map((response) => response.statusCode).sort(), [201, 409]);
    const concurrentUser = await prisma.user.findUniqueOrThrow({ where: { normalizedName: "concurrent admin user" } });
    assert.equal(await prisma.auditLog.count({ where: { action: "USER_CREATED", resourceId: concurrentUser.id } }), 1);
  } finally { await app.close(); }
});

void test("quick sales persist without tables and support normal checkout, cancellation, credit and tenant isolation", async (t) => {
  const app = await createAuthenticatedApp();
  t.after(() => app.close());
  const category = await prisma.menuCategory.findFirstOrThrow({ where: { establishmentId: integrationEstablishmentId } });
  const tablesBefore = await prisma.restaurantTable.findMany({ where: { establishmentId: integrationEstablishmentId }, orderBy: { id: "asc" } });
  const product = await prisma.product.create({ data: { establishmentId: integrationEstablishmentId, categoryId: category.id, code: "QUICK_SALE_TEST", name: "Produto venda rápida", priceCents: 1000, requiresKitchen: true } });
  const ingredient = await prisma.ingredient.create({ data: { establishmentId: integrationEstablishmentId, code: "QUICK_SALE_TEST", name: "Insumo venda rápida", unit: "UNIT" } });
  const stock = await prisma.inventoryStock.create({ data: { establishmentId: integrationEstablishmentId, ingredientId: ingredient.id, quantity: 10, minimumQuantity: 0 } });
  const actor = await prisma.user.findFirstOrThrow({ where: { establishmentId: integrationEstablishmentId, name: integrationUserName } });
  await prisma.inventoryLot.create({ data: { establishmentId: integrationEstablishmentId, stockId: stock.id, actorUserId: actor.id, code: "QUICK_SALE_TEST", currentQuantity: 10, initialQuantity: 10, origin: "PURCHASE", receivedAt: new Date(), totalCostCents: 1000 } });
  await prisma.productIngredient.create({ data: { establishmentId: integrationEstablishmentId, productId: product.id, ingredientId: ingredient.id, quantity: 1 } });
  const open = async (name: string) => {
    const response = await app.inject({ method: "POST", url: "/quick-sales", payload: { name } });
    assert.equal(response.statusCode, 201, response.body);
    return response.json<{ comanda: Comanda }>().comanda;
  };
  const add = async (id: string) => {
    const response = await app.inject({ method: "POST", url: `/comandas/${id}/items`, payload: { productId: product.id } });
    assert.equal(response.statusCode, 200, response.body);
    return response.json<{ comanda: Comanda }>().comanda.items[0];
  };
  const confirm = async (id: string, itemId: string) => {
    const response = await app.inject({ method: "POST", url: `/comandas/${id}/items/${itemId}/confirm` });
    assert.equal(response.statusCode, 200, response.body);
  };
  let secondaryApp: Awaited<ReturnType<typeof createAuthenticatedApp>> | undefined;
  try {
    const sale = await open("  Cliente rápido  ");
    const second = await open("Outro cliente");
    assert.equal(sale.table, null);
    assert.equal(sale.name, "Cliente rápido");
    assert.equal(sale.tableName, "Venda rápida");
    const persisted = await prisma.comanda.findUniqueOrThrow({ where: { id: sale.id }, include: { events: true } });
    assert.equal(persisted.tableId, null);
    assert.equal(persisted.tableName, "Venda rápida");
    assert.equal(persisted.name, "Cliente rápido");
    assert.ok(persisted.events[0].actorUserId);
    assert.equal(await prisma.auditLog.count({ where: { resourceId: sale.id, action: "COMANDA_OPENED", establishmentId: integrationEstablishmentId } }), 1);
    const list = await app.inject({ method: "GET", url: "/quick-sales" });
    assert.ok(list.json<{ comandas: Comanda[] }>().comandas.some(({ id }) => id === sale.id));
    assert.ok(list.json<{ comandas: Comanda[] }>().comandas.some(({ id }) => id === second.id));
    const item = await add(sale.id);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${sale.id}/close`, payload: { payments: [{ method: "PIX", amountCents: product.priceCents }] } })).statusCode, 409);
    await confirm(sale.id, item.id);
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity, 9);
    await confirm(sale.id, item.id);
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity, 9);
    const kitchen = await app.inject({ method: "GET", url: "/kitchen/tickets" });
    assert.equal(kitchen.statusCode, 200, kitchen.body);
    const ticket = kitchen.json<{ tickets: { comandaId: string; table: unknown; tableName: string | null; customerName: string | null }[] }>().tickets.find(({ comandaId }) => comandaId === sale.id);
    assert.equal(ticket?.table, null);
    assert.equal(ticket?.tableName, "Venda rápida");
    assert.equal(ticket?.customerName, "Cliente rápido");
    const receipt = await app.inject({ method: "GET", url: `/comandas/${sale.id}/print-document?kind=CONFIRMED` });
    assert.equal(receipt.statusCode, 200, receipt.body);
    assert.equal(receipt.json<{ document: { destination: string; comandaName: string | null } }>().document.destination, "QUICK_SALE");
    assert.equal(receipt.json<{ document: { destination: string; comandaName: string | null } }>().document.comandaName, "Cliente rápido");
    const close = await app.inject({ method: "POST", url: `/comandas/${sale.id}/close`, payload: { payments: [{ method: "PIX", amountCents: product.priceCents }] } });
    assert.equal(close.statusCode, 200, close.body);
    assert.equal(close.json<{ comanda: Comanda }>().comanda.status, "CLOSED");
    assert.equal(close.json<{ comanda: Comanda }>().comanda.payments[0].origin, "QUICK_SALE_CHECKOUT");
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${sale.id}/close` })).statusCode, 409);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${sale.id}/cancel` })).statusCode, 409);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${sale.id}/items`, payload: { productId: product.id } })).statusCode, 409);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${second.id}/cancel` })).statusCode, 200);
    const cancelled = await open("Cancelamento com itens");
    const cancelledItem = await add(cancelled.id);
    await confirm(cancelled.id, cancelledItem.id);
    const cancellation = await app.inject({ method: "POST", url: `/comandas/${cancelled.id}/cancel`, payload: { disposition: "RETURN_TO_STOCK", reason: "Cliente desistiu", requestId: `quick-cancel-${cancelled.id}` } });
    assert.equal(cancellation.statusCode, 200, cancellation.body);
    assert.equal(cancellation.json<{ comanda: Comanda }>().comanda.status, "CANCELLED");
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity, 9);
    const creditSale = await open("Cliente fiado rápido");
    const creditItem = await add(creditSale.id);
    await confirm(creditSale.id, creditItem.id);
    const customer = await prisma.creditCustomer.create({ data: { establishmentId: integrationEstablishmentId, name: "Cliente fiado rápido", normalizedName: "cliente fiado rápido" } });
    const credit = await app.inject({ method: "POST", url: `/comandas/${creditSale.id}/close`, payload: { customerId: customer.id, payments: [{ method: "CASH", amountCents: 100 }] } });
    assert.equal(credit.statusCode, 200, credit.body);
    assert.equal(credit.json<{ comanda: Comanda }>().comanda.credit?.source, "QUICK_SALE");
    assert.equal(credit.json<{ comanda: Comanda }>().comanda.credit?.balanceCents, product.priceCents - 100);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${creditSale.id}/close` })).statusCode, 409);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${creditSale.id}/cancel` })).statusCode, 409);
    const remaining = (await app.inject({ method: "GET", url: "/quick-sales" })).json<{ comandas: Comanda[] }>().comandas;
    assert.ok(!remaining.some(({ id }) => [sale.id, second.id, cancelled.id, creditSale.id].includes(id)));
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const report = await app.inject({ method: "GET", url: `/statements?from=${date}&to=${date}` });
    assert.equal(report.statusCode, 200, report.body);
    const entries = report.json<{ statement: StatementReport }>().statement.entries;
    const paidEntry = entries.find(({ comandaId, event }) => comandaId === sale.id && event === "QUICK_SALE_CLOSED");
    assert.equal(paidEntry?.origin, "QUICK_SALE");
    assert.equal(paidEntry?.customerName, "Cliente rápido");
    assert.equal(paidEntry?.receivedCents, product.priceCents);
    assert.equal(paidEntry?.tableNumber, null);
    const creditEntries = entries.filter(({ comandaId }) => comandaId === creditSale.id);
    assert.equal(creditEntries.reduce((total, entry) => total + entry.soldCents, 0), product.priceCents);
    assert.equal(creditEntries.reduce((total, entry) => total + entry.receivedCents, 0), 100);
    assert.ok(creditEntries.every(({ origin }) => origin === "QUICK_SALE"));
    const pdf = await app.inject({ method: "GET", url: `/statements/export.pdf?from=${date}&to=${date}&origin=QUICK_SALE` });
    assert.equal(pdf.statusCode, 200, pdf.body.slice(0, 100));
    const creditOrder = credit.json<{ comanda: Comanda }>().comanda.credit;
    assert.ok(creditOrder);
    const settlement = await app.inject({ method: "POST", url: `/credit-orders/${creditOrder.orderId}/settle`, payload: { payments: [{ method: "PIX", amountCents: product.priceCents - 100 }] } });
    assert.equal(settlement.statusCode, 200, settlement.body);
    assert.equal((await prisma.comanda.findUniqueOrThrow({ where: { id: creditSale.id } })).status, "CLOSED");
    const settledReport = (await app.inject({ method: "GET", url: `/statements?from=${date}&to=${date}` })).json<{ statement: StatementReport }>().statement;
    const settledEntries = settledReport.entries.filter(({ comandaId }) => comandaId === creditSale.id);
    assert.equal(settledEntries.reduce((total, entry) => total + entry.soldCents, 0), product.priceCents);
    assert.equal(settledEntries.reduce((total, entry) => total + entry.receivedCents, 0), product.priceCents);
    const isolatedSale = await open("Venda privada em aberto");
    await provisionEstablishment(prisma, { name: "Quick Sale Isolation Bistro", ownerName: "Quick Sale Other Owner", ownerPassword: integrationUserPassword });
    secondaryApp = await createAuthenticatedApp("Quick Sale Other Owner", integrationUserPassword);
    assert.deepEqual((await secondaryApp.inject({ method: "GET", url: "/quick-sales" })).json(), { comandas: [] });
    assert.equal((await secondaryApp.inject({ method: "GET", url: `/comandas/${isolatedSale.id}` })).statusCode, 404);
    assert.equal((await secondaryApp.inject({ method: "POST", url: `/comandas/${isolatedSale.id}/items`, payload: { productId: product.id } })).statusCode, 404);
    assert.equal((await secondaryApp.inject({ method: "POST", url: `/comandas/${isolatedSale.id}/cancel` })).statusCode, 404);
    assert.equal((await app.inject({ method: "POST", url: `/comandas/${isolatedSale.id}/cancel` })).statusCode, 200);
    assert.deepEqual(await prisma.restaurantTable.findMany({ where: { establishmentId: integrationEstablishmentId }, orderBy: { id: "asc" } }), tablesBefore);
  } finally {
    await secondaryApp?.close();
    await cleanupEstablishment("Quick Sale Isolation Bistro");
  }
});

void test("batch confirmation is atomic, idempotent, concurrent-safe and tenant-scoped", async (t) => {
  await resetOperationalData(prisma, integrationEstablishmentId);
  const app = await createAuthenticatedApp();
  t.after(() => app.close());
  const category = await prisma.menuCategory.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId },
  });
  const missingRecipeProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "BATCH_MISSING_RECIPE",
      establishmentId: integrationEstablishmentId,
      name: "Produto sem receita em lote",
      priceCents: 900,
      requiresKitchen: true,
    },
  });
  const insufficientProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "BATCH_INSUFFICIENT_STOCK",
      establishmentId: integrationEstablishmentId,
      name: "Produto com deficit em lote",
      priceCents: 1_100,
      requiresKitchen: true,
    },
  });
  const ingredient = await prisma.ingredient.create({
    data: {
      code: "BATCH_INSUFFICIENT_STOCK",
      establishmentId: integrationEstablishmentId,
      name: "Insumo de lote sem saldo",
      unit: "UNIT",
    },
  });
  const stock = await prisma.inventoryStock.create({
    data: {
      establishmentId: integrationEstablishmentId,
      ingredientId: ingredient.id,
      minimumQuantity: 0,
      quantity: 0,
    },
  });
  await prisma.productIngredient.create({
    data: {
      establishmentId: integrationEstablishmentId,
      ingredientId: ingredient.id,
      productId: insufficientProduct.id,
      quantity: 2,
    },
  });

  const openSale = async (name: string) => {
    const response = await app.inject({
      method: "POST",
      payload: { name },
      url: "/quick-sales",
    });
    assert.equal(response.statusCode, 201, response.body);
    return response.json<{ comanda: Comanda }>().comanda;
  };
  const addProduct = async (comandaId: string, productId: string) => {
    const response = await app.inject({
      method: "POST",
      payload: { productId },
      url: `/comandas/${comandaId}/items`,
    });
    assert.equal(response.statusCode, 200, response.body);
    return response
      .json<{ comanda: Comanda }>()
      .comanda.items.find((item) => item.productId === productId)!;
  };
  const createPendingBatch = async (name: string) => {
    const comanda = await openSale(name);
    const first = await addProduct(comanda.id, missingRecipeProduct.id);
    const second = await addProduct(comanda.id, insufficientProduct.id);
    return {
      comanda,
      items: [first, second].map((item) => ({
        expectedConfirmedQuantity: item.confirmedQuantity,
        expectedQuantity: item.quantity,
        itemId: item.id,
      })),
    };
  };

  const firstBatch = await createPendingBatch("Lote atomico");
  const conflicting = await app.inject({
    method: "POST",
    payload: {
      items: [
        firstBatch.items[0],
        { ...firstBatch.items[1], expectedQuantity: 2 },
      ],
      requestId: "batch-atomic-conflict",
    },
    url: `/comandas/${firstBatch.comanda.id}/items/confirm-batch`,
  });
  assert.equal(conflicting.statusCode, 409, conflicting.body);
  assert.equal(
    await prisma.comandaItem.count({
      where: {
        comandaId: firstBatch.comanda.id,
        confirmedQuantity: { gt: 0 },
      },
    }),
    0,
  );
  assert.equal(
    await prisma.comandaConfirmationBatch.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    0,
  );
  assert.equal(
    await prisma.kitchenTicket.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    0,
  );
  assert.equal(
    await prisma.inventoryOperation.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    0,
  );

  const payload = {
    items: firstBatch.items,
    requestId: "batch-atomic-success",
  };
  const confirmed = await app.inject({
    method: "POST",
    payload,
    url: `/comandas/${firstBatch.comanda.id}/items/confirm-batch`,
  });
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  const confirmedBody = confirmed.json<{
    comanda: Comanda;
    inventoryWarnings: Array<{ type: string }>;
    replayed: boolean;
  }>();
  assert.equal(confirmedBody.replayed, false);
  assert.equal(
    confirmedBody.comanda.items.every(
      (item) => item.confirmedQuantity === item.quantity,
    ),
    true,
  );
  assert.deepEqual(
    confirmedBody.inventoryWarnings.map(({ type }) => type).sort(),
    ["INSUFFICIENT_STOCK", "MISSING_RECIPE"],
  );
  assert.equal(
    await prisma.kitchenTicket.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    2,
  );
  assert.equal(
    await prisma.inventoryOperation.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    2,
  );
  assert.deepEqual(
    await prisma.inventoryStock.findUniqueOrThrow({
      select: { deficitQuantity: true, quantity: true },
      where: { id: stock.id },
    }),
    { deficitQuantity: 2, quantity: -2 },
  );
  assert.equal(
    await prisma.auditLog.count({
      where: {
        action: "COMANDA_ITEMS_CONFIRMED_BATCH",
        establishmentId: integrationEstablishmentId,
        resourceId: firstBatch.comanda.id,
      },
    }),
    1,
  );

  const replay = await app.inject({
    method: "POST",
    payload,
    url: `/comandas/${firstBatch.comanda.id}/items/confirm-batch`,
  });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.json<{ replayed: boolean }>().replayed, true);
  assert.equal(
    await prisma.kitchenTicket.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    2,
  );
  assert.equal(
    await prisma.inventoryOperation.count({
      where: { comandaId: firstBatch.comanda.id },
    }),
    2,
  );
  const fingerprintConflict = await app.inject({
    method: "POST",
    payload: {
      items: payload.items.map((item, index) =>
        index === 0 ? { ...item, expectedQuantity: item.expectedQuantity + 1 } : item,
      ),
      requestId: payload.requestId,
    },
    url: `/comandas/${firstBatch.comanda.id}/items/confirm-batch`,
  });
  assert.equal(fingerprintConflict.statusCode, 409, fingerprintConflict.body);

  const concurrentBatch = await createPendingBatch("Lote concorrente");
  const concurrentPayload = {
    items: concurrentBatch.items,
    requestId: "batch-concurrent-retry",
  };
  const concurrentResponses = await Promise.all([
    app.inject({
      method: "POST",
      payload: concurrentPayload,
      url: `/comandas/${concurrentBatch.comanda.id}/items/confirm-batch`,
    }),
    app.inject({
      method: "POST",
      payload: concurrentPayload,
      url: `/comandas/${concurrentBatch.comanda.id}/items/confirm-batch`,
    }),
  ]);
  assert.deepEqual(
    concurrentResponses.map(({ statusCode }) => statusCode),
    [200, 200],
  );
  assert.equal(
    await prisma.comandaConfirmationBatch.count({
      where: {
        establishmentId: integrationEstablishmentId,
        requestId: concurrentPayload.requestId,
      },
    }),
    1,
  );
  assert.equal(
    await prisma.kitchenTicket.count({
      where: { comandaId: concurrentBatch.comanda.id },
    }),
    2,
  );
  assert.equal(
    await prisma.inventoryOperation.count({
      where: { comandaId: concurrentBatch.comanda.id },
    }),
    2,
  );

  const isolationName = "Batch Isolation Bistro";
  await provisionEstablishment(prisma, {
    name: isolationName,
    ownerName: "Batch Isolation Owner",
    ownerPassword: integrationUserPassword,
  });
  const otherApp = await createAuthenticatedApp(
    "Batch Isolation Owner",
    integrationUserPassword,
  );
  try {
    const isolated = await otherApp.inject({
      method: "POST",
      payload,
      url: `/comandas/${firstBatch.comanda.id}/items/confirm-batch`,
    });
    assert.equal(isolated.statusCode, 404, isolated.body);
  } finally {
    await otherApp.close();
    await cleanupEstablishment(isolationName);
  }
});

void test("absolute pending quantity and discard preserve confirmed items atomically", async () => {
  const app = await createAuthenticatedApp();
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true },
    take: 2,
    where: { active: true, establishmentId: integrationEstablishmentId },
  });
  assert.equal(products.length, 2);

  try {
    const opened = await app.inject({
      method: "POST",
      payload: { name: "Quantidade direta" },
      url: "/quick-sales",
    });
    assert.equal(opened.statusCode, 201);
    const comandaId = opened.json<{ comanda: Comanda }>().comanda.id;

    const firstAdded = await app.inject({
      method: "POST",
      payload: { productId: products[0].id },
      url: `/comandas/${comandaId}/items`,
    });
    const firstItemId = firstAdded.json<{ comanda: Comanda }>().comanda.items[0].id;

    const setQuantity = await app.inject({
      method: "PATCH",
      payload: { pendingQuantity: 7 },
      url: `/comandas/${comandaId}/items/${firstItemId}`,
    });
    assert.equal(setQuantity.statusCode, 200);
    assert.equal(
      setQuantity
        .json<{ comanda: Comanda }>()
        .comanda.items.find(({ id }) => id === firstItemId)?.quantity,
      7,
    );

    const confirmed = await app.inject({
      method: "POST",
      url: `/comandas/${comandaId}/items/${firstItemId}/confirm`,
    });
    assert.equal(confirmed.statusCode, 200);

    await app.inject({
      method: "POST",
      payload: { productId: products[0].id },
      url: `/comandas/${comandaId}/items`,
    });
    await app.inject({
      method: "POST",
      payload: { productId: products[1].id },
      url: `/comandas/${comandaId}/items`,
    });

    const discarded = await app.inject({
      method: "DELETE",
      url: `/comandas/${comandaId}/items/pending`,
    });
    assert.equal(discarded.statusCode, 200);
    const remainingItems = discarded.json<{ comanda: Comanda }>().comanda.items;
    assert.equal(remainingItems.length, 1);
    assert.equal(remainingItems[0].id, firstItemId);
    assert.equal(remainingItems[0].confirmedQuantity, 7);
    assert.equal(remainingItems[0].quantity, 7);

    const configurations = await prisma.comandaItemConfiguration.findMany({
      select: { confirmedQuantity: true, quantity: true },
      where: { comandaItemId: firstItemId },
    });
    assert.ok(configurations.length > 0);
    assert.ok(
      configurations.every(
        ({ confirmedQuantity, quantity }) => quantity === confirmedQuantity,
      ),
    );
  } finally {
    await app.close();
  }
});

void test("today dashboard scopes live metrics by tenant and permission", async (t) => {
  await resetOperationalData(prisma, integrationEstablishmentId);
  const ownerApp = await createAuthenticatedApp();
  t.after(() => ownerApp.close());
  const category = await prisma.menuCategory.findFirstOrThrow({
    where: { establishmentId: integrationEstablishmentId },
  });
  const kitchenProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "DASHBOARD_KITCHEN_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Produto painel cozinha",
      priceCents: 800,
      requiresKitchen: true,
    },
  });
  const saleProduct = await prisma.product.create({
    data: {
      categoryId: category.id,
      code: "DASHBOARD_SALE_PRODUCT",
      establishmentId: integrationEstablishmentId,
      name: "Produto painel venda",
      priceCents: 1_250,
      requiresKitchen: false,
    },
  });
  const tables = await prisma.restaurantTable.findMany({
    orderBy: { number: "asc" },
    take: 2,
    where: { establishmentId: integrationEstablishmentId },
  });
  assert.equal(tables.length, 2);
  for (const table of tables) {
    const opened = await ownerApp.inject({
      method: "POST",
      url: `/tables/${table.id}/comandas`,
    });
    assert.equal(opened.statusCode, 201, opened.body);
  }
  const firstTable = await prisma.restaurantTable.findUniqueOrThrow({
    where: { id: tables[0].id },
  });
  assert.ok(firstTable.activeComandaId);
  const kitchenItemResponse = await ownerApp.inject({
    method: "POST",
    payload: { productId: kitchenProduct.id },
    url: `/comandas/${firstTable.activeComandaId}/items`,
  });
  assert.equal(kitchenItemResponse.statusCode, 200, kitchenItemResponse.body);
  const kitchenItem = kitchenItemResponse
    .json<{ comanda: Comanda }>()
    .comanda.items.find((item) => item.productId === kitchenProduct.id)!;
  const kitchenConfirmation = await ownerApp.inject({
    method: "POST",
    url: `/comandas/${firstTable.activeComandaId}/items/${kitchenItem.id}/confirm`,
  });
  assert.equal(kitchenConfirmation.statusCode, 200, kitchenConfirmation.body);
  await prisma.restaurantTable.update({
    data: { status: "AWAITING_CHECK" },
    where: { id: tables[1].id },
  });

  const quickSaleResponse = await ownerApp.inject({
    method: "POST",
    payload: { name: "Venda do painel" },
    url: "/quick-sales",
  });
  assert.equal(quickSaleResponse.statusCode, 201, quickSaleResponse.body);
  const quickSale = quickSaleResponse.json<{ comanda: Comanda }>().comanda;
  const saleItemResponse = await ownerApp.inject({
    method: "POST",
    payload: { productId: saleProduct.id },
    url: `/comandas/${quickSale.id}/items`,
  });
  assert.equal(saleItemResponse.statusCode, 200, saleItemResponse.body);
  const saleItem = saleItemResponse
    .json<{ comanda: Comanda }>()
    .comanda.items.find((item) => item.productId === saleProduct.id)!;
  const saleConfirmation = await ownerApp.inject({
    method: "POST",
    url: `/comandas/${quickSale.id}/items/${saleItem.id}/confirm`,
  });
  assert.equal(saleConfirmation.statusCode, 200, saleConfirmation.body);
  const closeSale = await ownerApp.inject({
    method: "POST",
    payload: {
      payments: [{ amountCents: saleProduct.priceCents, method: "PIX" }],
    },
    url: `/comandas/${quickSale.id}/close`,
  });
  assert.equal(closeSale.statusCode, 200, closeSale.body);

  const ownerDashboard = await ownerApp.inject({
    method: "GET",
    url: "/dashboard/today",
  });
  assert.equal(ownerDashboard.statusCode, 200, ownerDashboard.body);
  const ownerToday = ownerDashboard.json<{
    today: {
      closedSalesCents: number | null;
      date: string;
      occupiedTables: number | null;
      pendingKitchenTickets: number | null;
    };
  }>().today;
  assert.equal(ownerToday.closedSalesCents, saleProduct.priceCents);
  assert.equal(ownerToday.occupiedTables, 2);
  assert.equal(ownerToday.pendingKitchenTickets, 1);
  assert.equal(
    ownerToday.date,
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(new Date()),
  );

  await provisionUser(prisma, {
    establishmentName: integrationEstablishmentName,
    name: "Dashboard Waiter",
    password: integrationUserPassword,
    roleCodes: ["WAITER"],
  });
  await provisionUser(prisma, {
    establishmentName: integrationEstablishmentName,
    name: "Dashboard Kitchen",
    password: integrationUserPassword,
    roleCodes: ["KITCHEN"],
  });
  const waiterApp = await createAuthenticatedApp(
    "Dashboard Waiter",
    integrationUserPassword,
  );
  const kitchenApp = await createAuthenticatedApp(
    "Dashboard Kitchen",
    integrationUserPassword,
  );
  try {
    const waiterToday = (
      await waiterApp.inject({ method: "GET", url: "/dashboard/today" })
    ).json<{ today: typeof ownerToday }>().today;
    assert.equal(waiterToday.closedSalesCents, null);
    assert.equal(waiterToday.occupiedTables, 2);
    assert.equal(waiterToday.pendingKitchenTickets, null);

    const kitchenToday = (
      await kitchenApp.inject({ method: "GET", url: "/dashboard/today" })
    ).json<{ today: typeof ownerToday }>().today;
    assert.equal(kitchenToday.closedSalesCents, null);
    assert.equal(kitchenToday.occupiedTables, 2);
    assert.equal(kitchenToday.pendingKitchenTickets, 1);
  } finally {
    await waiterApp.close();
    await kitchenApp.close();
  }

  const isolationName = "Dashboard Isolation Bistro";
  await provisionEstablishment(prisma, {
    name: isolationName,
    ownerName: "Dashboard Isolation Owner",
    ownerPassword: integrationUserPassword,
  });
  const otherApp = await createAuthenticatedApp(
    "Dashboard Isolation Owner",
    integrationUserPassword,
  );
  try {
    const otherToday = (
      await otherApp.inject({ method: "GET", url: "/dashboard/today" })
    ).json<{ today: typeof ownerToday }>().today;
    assert.equal(otherToday.closedSalesCents, 0);
    assert.equal(otherToday.occupiedTables, 0);
    assert.equal(otherToday.pendingKitchenTickets, 0);
  } finally {
    await otherApp.close();
    await cleanupEstablishment(isolationName);
  }
});


void test('counter printing filters live deliveries, blocks premature final, isolates access and has no operational side effects', async () => {
  const repository = createComandaRepository(prisma);
  const counter = repository.counterSales!;
  const tenant = counterEstablishmentId;
  const actor = await prisma.user.findFirstOrThrow({ where: { establishmentId: tenant } });
  const category = await prisma.menuCategory.findFirstOrThrow({ where: { establishmentId: tenant } });
  const product = await prisma.product.create({ data: { establishmentId: tenant, categoryId: category.id,
    code: 'COUNTER_PRINT_DRINK', name: 'Café balcão impressão', priceCents: 500, requiresKitchen: false } });
  const sale = await counter.open(tenant, actor.id, 'counter-print-open');
  const app = await createAuthenticatedApp('Counter Integration Operator', integrationUserPassword);
  const other = await createAuthenticatedApp();
  const print = (kind: string) => app.inject({ url: `/comandas/${sale.id}/print-document?kind=${kind}` });
  const state = async () => ({
    sale: await repository.findById(tenant, sale.id),
    payments: await prisma.payment.count({ where: { comandaId: sale.id } }),
    audit: await prisma.auditLog.count({ where: { establishmentId: tenant } }),
    movements: await prisma.inventoryMovement.count({ where: { establishmentId: tenant } }),
    tickets: await prisma.kitchenTicket.count({ where: { comandaId: sale.id } }),
  });
  try {
    for (const kind of ['COUNTER_PENDING', 'COUNTER_FINAL']) assert.equal((await print(kind)).statusCode, 409);
    const added = await repository.addItem(tenant, sale.id, product.id, actor.id);
    const itemId = added.items[0].id;
    await repository.changeItemQuantity(tenant, sale.id, itemId, 1, actor.id);
    await repository.changeItemQuantity(tenant, sale.id, itemId, 1, actor.id);
    const before = await state();
    for (const kind of ['COUNTER_PENDING', 'COUNTER_FINAL']) {
      assert.equal((await other.inject({ url: `/comandas/${sale.id}/print-document?kind=${kind}` })).statusCode, 404);
      assert.equal((await app.inject({ url: `/comandas/${sale.id}/print-document?kind=${kind}`, headers: { authorization: '' } })).statusCode, 401);
    }
    const pending = await print('COUNTER_PENDING');
    assert.equal(pending.statusCode, 200, pending.body);
    const pendingDocument = pending.json<{ document: { items: { quantity: number; unitPriceCents: number }[]; totalCents: number; serviceFee?: unknown } }>().document;
    assert.equal(pendingDocument.items[0].quantity, 3);
    assert.equal(pendingDocument.items[0].unitPriceCents, 500);
    assert.equal(pendingDocument.totalCents, 1500);
    assert.equal(pendingDocument.serviceFee, undefined);
    assert.equal((await print('COUNTER_FINAL')).statusCode, 409);
    assert.equal((await print('COUNTER_PENDING')).statusCode, 200);
    assert.deepEqual(await state(), before);
    await repository.confirmItem(tenant, sale.id, itemId, actor.id);
    const delivered = await state();
    assert.equal((await print('COUNTER_PENDING')).statusCode, 409);
    const final = await print('COUNTER_FINAL');
    assert.equal(final.statusCode, 200, final.body);
    assert.equal(final.json<{ document: { totalCents: number } }>().document.totalCents, 1500);
    assert.deepEqual(await state(), delivered);
    await repository.addItem(tenant, sale.id, product.id, actor.id);
    assert.equal((await print('COUNTER_FINAL')).statusCode, 409);
    const newPending = await print('COUNTER_PENDING');
    assert.equal(newPending.json<{ document: { totalCents: number } }>().document.totalCents, 500);
    await repository.removeItem(tenant, sale.id, itemId, actor.id);
    const updated = await print('COUNTER_FINAL');
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json<{ document: { totalCents: number } }>().document.totalCents, 1500);
    // Printing permission alone cannot read counter sales or another operational source.
    await provisionUser(prisma, { establishmentName: counterEstablishmentName, name: 'Counter Print Kitchen',
      password: integrationUserPassword, roleCodes: ['KITCHEN'] });
    const kitchenRole = await prisma.tenantRole.findUniqueOrThrow({ where: { establishmentId_code: { establishmentId: tenant, code: 'KITCHEN' } } });
    await prisma.tenantRolePermission.deleteMany({ where: { roleId: kitchenRole.id, permission: { code: { in: ['counter-sales.read', 'counter-sales.write'] } } } });
    const kitchen = await createAuthenticatedApp('Counter Print Kitchen', integrationUserPassword);
    try {
      for (const kind of ['COUNTER_PENDING', 'COUNTER_FINAL', 'CONFIRMED']) {
        assert.equal((await kitchen.inject({ url: `/comandas/${sale.id}/print-document?kind=${kind}` })).statusCode, 403);
      }
    } finally { await kitchen.close(); }
    const quick = await repository.openQuickSale(tenant, 'Impressão não balcão', actor.id);
    assert.equal((await app.inject({ url: `/comandas/${quick.id}/print-document?kind=COUNTER_PENDING` })).statusCode, 409);
    assert.equal((await app.inject({ url: `/comandas/${quick.id}/print-document?kind=COUNTER_FINAL` })).statusCode, 409);
    assert.equal((await repository.findById(tenant, sale.id)).status, 'OPEN');
    assert.equal(await prisma.payment.count({ where: { comandaId: sale.id } }), 0);
    const cancelled = await counter.open(tenant, actor.id, 'counter-print-cancelled');
    await repository.cancel(tenant, cancelled.id, null, false, actor.id);
    for (const kind of ['COUNTER_PENDING', 'COUNTER_FINAL']) {
      assert.equal((await app.inject({ url: `/comandas/${cancelled.id}/print-document?kind=${kind}` })).statusCode, 409);
    }
  } finally { await app.close(); await other.close(); }
});
