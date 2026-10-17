import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { registerAuthentication } from '../../src/authentication.js';
import { registerCounterSalesRoutes } from '../../src/routes/counter-sales-routes.js';
import { normalizePaymentAllocations } from '../../src/payment-types.js';
import type { CounterSalesRepository } from '../../src/counter-sales-types.js';
import type { AuthUser } from '../../src/auth-types.js';

const user: AuthUser = { id: 'operator', name: 'Operator', establishment: { id: 'tenant', name: 'Bistro' },
  permissions: ['counter-sales.read', 'counter-sales.write'], roles: [] };
const headers = { authorization: `Bearer ${'a'.repeat(24)}` };

async function setup(permissions = user.permissions) {
  const calls: unknown[][] = [];
  const app = Fastify();
  registerAuthentication(app, {
    authenticate: () => Promise.resolve({ ...user, permissions }),
    login: () => Promise.reject(new Error('unused')), logout: () => Promise.resolve(),
  });
  const repository: CounterSalesRepository = {
    open: (...args) => { calls.push(args); return Promise.resolve({} as never); },
    complete: (...args) => { calls.push(args); return Promise.resolve({} as never); },
    list: (...args) => { calls.push(args); return Promise.resolve([]); },
    rename: (...args) => { calls.push(args); return Promise.resolve({} as never); },
  };
  registerCounterSalesRoutes(app, repository);
  await app.ready();
  return { app, calls };
}

void test('counter routes require authentication and permissions before touching the repository', async () => {
  const { app, calls } = await setup([]);
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/counter-sales', payload: { requestId: 'open-request-1' } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/counter-sales', headers, payload: { requestId: 'open-request-1' } })).statusCode, 403);
    assert.equal(calls.length, 0);
  } finally { await app.close(); }
});

void test('counter completion uses only authenticated tenant/operator and never accepts financial input', async () => {
  const { app, calls } = await setup();
  try {
    const result = await app.inject({ method: 'POST', url: '/counter-sales/sale/complete', headers, payload: { requestId: 'close-request-1', expectedSnapshot: 'a'.repeat(64) } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(calls[0], ['tenant', 'operator', 'sale', 'close-request-1', 'a'.repeat(64)]);
    for (const extra of [{ totalCents: 1 }, { payments: [] }, { establishmentId: 'foreign' }, { method: 'CASH' }]) {
      assert.equal((await app.inject({ method: 'POST', url: '/counter-sales/sale/complete', headers,
        payload: { requestId: 'close-request-2', expectedSnapshot: 'a'.repeat(64), ...extra } })).statusCode, 400);
    }
    assert.equal(calls.length, 1);
  } finally { await app.close(); }
});

void test('counter dates and optional names are validated', async () => {
  const { app, calls } = await setup();
  try {
    assert.equal((await app.inject({ url: '/counter-sales?status=CLOSED&date=2026-02-30', headers })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PUT', url: '/counter-sales/sale/name', headers, payload: { name: '   ' } })).statusCode, 200);
    assert.deepEqual(calls[0], ['tenant', 'operator', 'sale', null]);
  } finally { await app.close(); }
});

void test('ordinary payment input never accepts the server-only COUNTER method', () => {
  assert.throws(() => normalizePaymentAllocations([{ method: 'COUNTER', amountCents: 100 }]));
});
