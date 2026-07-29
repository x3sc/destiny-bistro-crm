import {
  cancelCreditOrder,
  convertComandaToCredit,
  createCreditCustomer,
  createCreditOrder,
  finalizeCreditOrder,
  loadCreditCustomer,
  loadCreditCustomers,
  settleCreditOrder,
} from '../credits-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const customer = {
  balanceCents: 2198,
  draftOrderCount: 1,
  id: 'customer/id',
  name: 'Maria',
  openOrderCount: 2,
};
const order = {
  cancelledAt: null,
  comandaId: 'comanda/id',
  comandaName: 'Maria',
  comandaNumber: 42,
  customerId: 'customer/id',
  customerName: 'Maria',
  finalizedAt: null,
  hasPendingItems: false,
  id: 'order/id',
  orderedAt: '2026-07-28T18:00:00.000Z',
  settledAt: null,
  source: 'MANUAL',
  status: 'DRAFT',
  tableNumber: null,
  totalCents: 0,
};
const settlement = {
  amountCents: 2198,
  id: 'settlement/id',
  orderId: 'order/id',
  paidAt: '2026-07-28T19:00:00.000Z',
};

beforeAll(() => {
  globalThis.fetch = mockFetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  mockFetch.mockReset();
});

it('loads active or all credit customers', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ customers: [customer] }),
    ok: true,
  });

  await expect(
    loadCreditCustomers('http://localhost:3333/', true),
  ).resolves.toEqual([customer]);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/credit-customers?includeInactive=true',
  );
});

it('creates a normalized customer request and manual order', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ customer }),
      ok: true,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ order }),
      ok: true,
    });

  await expect(
    createCreditCustomer('http://localhost:3333', '  Maria  '),
  ).resolves.toEqual(customer);
  await expect(
    createCreditOrder('http://localhost:3333', 'customer/id'),
  ).resolves.toEqual(order);

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/credit-customers',
    expect.objectContaining({
      body: JSON.stringify({ name: 'Maria' }),
      method: 'POST',
    }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:3333/credit-customers/customer%2Fid/orders',
    expect.objectContaining({ method: 'POST' }),
  );
});

it('loads customer details and settles the total balance', async () => {
  const details = {
    ...customer,
    orders: [order],
    settlements: [],
  };
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ customer: details }),
      ok: true,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ settlement }),
      ok: true,
    });

  await expect(
    loadCreditCustomer('http://localhost:3333', 'customer/id'),
  ).resolves.toEqual(details);
  await expect(
    settleCreditOrder('http://localhost:3333', 'order/id'),
  ).resolves.toEqual(settlement);
  expect(mockFetch).toHaveBeenLastCalledWith(
    'http://localhost:3333/credit-orders/order%2Fid/settle',
    expect.objectContaining({ method: 'POST' }),
  );
});

it('finalizes and cancels drafts through explicit endpoints', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ order: { ...order, status: 'OPEN' } }),
      ok: true,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ order: { ...order, status: 'CANCELLED' } }),
      ok: true,
    });

  await finalizeCreditOrder('http://localhost:3333', 'order/id');
  await cancelCreditOrder('http://localhost:3333', 'order/id');

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/credit-orders/order%2Fid/finalize',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:3333/credit-orders/order%2Fid/cancel',
    expect.objectContaining({ method: 'POST' }),
  );
});

it('converts a table comanda to credit', async () => {
  const tableOrder = {
    ...order,
    finalizedAt: '2026-07-28T19:00:00.000Z',
    source: 'TABLE',
    status: 'OPEN',
    tableNumber: 4,
    totalCents: 1099,
  };
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ order: tableOrder }),
    ok: true,
  });

  await expect(
    convertComandaToCredit(
      'http://localhost:3333',
      'comanda/id',
      'customer/id',
    ),
  ).resolves.toEqual(tableOrder);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/comandas/comanda%2Fid/credit',
    expect.objectContaining({
      body: JSON.stringify({ customerId: 'customer/id' }),
      method: 'POST',
    }),
  );
});
