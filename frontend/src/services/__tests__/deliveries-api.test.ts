import {
  closeDeliveryDay,
  advanceDeliveryOrder,
  createDeliveryOrder,
  createDeliveryCourier,
  loadDeliveryCourier,
  loadDeliveryCouriers,
  loadDeliveryDay,
  loadDeliveryOrder,
  loadDeliveryOrders,
  openDeliveryDay,
  recordDelivery,
  recordDeliveryExpense,
} from '../deliveries-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const courier = {
  activeDayId: 'day/id',
  id: 'courier/id',
  name: 'João',
  settledTotalCents: 7500,
};
const day = {
  closedAt: null,
  courierId: courier.id,
  courierName: courier.name,
  dailyRateCents: 8000,
  deliveries: [
    {
      address: 'Rua das Flores, 120',
      customerName: 'Marina',
      deliveredAt: '2026-08-11T21:00:00.000Z',
      feeCents: 500,
      id: 'delivery/id',
      paymentMethod: 'PIX',
      products: 'Pizza calabresa',
      recordedBy: { id: 'user/id', name: 'Operador' },
      totalCents: 5000,
    },
  ],
  deliveryCount: 1,
  expenses: [
    {
      amountCents: 1000,
      createdAt: '2026-08-11T22:00:00.000Z',
      description: 'Combustível',
      id: 'expense/id',
      recordedBy: { id: 'user/id', name: 'Operador' },
    },
  ],
  expensesTotalCents: 1000,
  feesTotalCents: 500,
  id: 'day/id',
  openedAt: '2026-08-11T18:00:00.000Z',
  payoutCents: 7500,
  salesTotalCents: 5000,
  settlementPaidCents: null,
  status: 'OPEN',
};
const courierDetails = {
  ...courier,
  days: [
    {
      closedAt: day.closedAt,
      courierId: day.courierId,
      courierName: day.courierName,
      dailyRateCents: day.dailyRateCents,
      deliveryCount: day.deliveryCount,
      expensesTotalCents: day.expensesTotalCents,
      feesTotalCents: day.feesTotalCents,
      id: day.id,
      openedAt: day.openedAt,
      payoutCents: day.payoutCents,
      salesTotalCents: day.salesTotalCents,
      settlementPaidCents: day.settlementPaidCents,
      status: day.status,
    },
  ],
  periodPayoutCents: 7500,
  periodSettledCents: 0,
};
const order = {
  address: 'Rua das Flores, 120',
  comandaId: 'comanda/id',
  comandaNumber: 43,
  courierName: null,
  createdAt: '2026-08-11T18:00:00.000Z',
  customerName: 'Marina',
  dayId: null,
  deliveredAt: null,
  dispatchedAt: null,
  feeCents: 500,
  hasPendingItems: false,
  id: 'order/id',
  itemCount: 2,
  paidCents: 0,
  paymentStatus: 'OPEN',
  phone: '11999999999',
  status: 'NEW',
  totalCents: 5000,
  updatedAt: '2026-08-11T18:00:00.000Z',
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

it('lists couriers and loads an encoded courier period', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ couriers: [courier] }),
      ok: true,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ courier: courierDetails }),
      ok: true,
    });

  await expect(loadDeliveryCouriers('http://localhost:3333/')).resolves.toEqual([
    courier,
  ]);
  await expect(
    loadDeliveryCourier('http://localhost:3333', courier.id, {
      from: '2026-08-01',
      to: '2026-08-11',
    }),
  ).resolves.toEqual(courierDetails);

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/delivery/couriers',
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:3333/delivery/couriers/courier%2Fid?from=2026-08-01&to=2026-08-11',
  );
});

it('creates, lists, loads and advances delivery orders', async () => {
  mockFetch
    .mockResolvedValueOnce({ json: () => Promise.resolve({ orders: [order] }), ok: true })
    .mockResolvedValueOnce({ json: () => Promise.resolve({ order }), ok: true })
    .mockResolvedValueOnce({ json: () => Promise.resolve({ order }), ok: true })
    .mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          order: { ...order, dayId: 'day/id', status: 'OUT_FOR_DELIVERY' },
        }),
      ok: true,
    });

  await expect(loadDeliveryOrders('http://localhost:3333', true)).resolves.toEqual([
    order,
  ]);
  await expect(
    createDeliveryOrder('http://localhost:3333', {
      address: order.address,
      customerName: order.customerName,
      feeCents: order.feeCents,
      phone: order.phone,
    }),
  ).resolves.toEqual(order);
  await expect(
    loadDeliveryOrder('http://localhost:3333', order.id),
  ).resolves.toEqual(order);
  await expect(
    advanceDeliveryOrder(
      'http://localhost:3333',
      order.id,
      'OUT_FOR_DELIVERY',
      'day/id',
    ),
  ).resolves.toMatchObject({ dayId: 'day/id', status: 'OUT_FOR_DELIVERY' });

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/delivery/orders?history=true',
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    4,
    'http://localhost:3333/delivery/orders/order%2Fid/status',
    expect.objectContaining({
      body: JSON.stringify({ status: 'OUT_FOR_DELIVERY', dayId: 'day/id' }),
      method: 'POST',
    }),
  );
});

it('creates a trimmed courier and reports duplicate names', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ courier }),
      ok: true,
      status: 201,
    })
    .mockResolvedValueOnce({ ok: false, status: 409 });

  await expect(
    createDeliveryCourier('http://localhost:3333/', '  João  '),
  ).resolves.toEqual(courier);
  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/delivery/couriers',
    {
      body: JSON.stringify({ name: 'João' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  await expect(
    createDeliveryCourier('http://localhost:3333', 'João'),
  ).rejects.toThrow('Já existe um entregador com esse nome.');
});

it('opens and loads a day using encoded resource ids', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ day }),
      ok: true,
      status: 201,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ day }),
      ok: true,
    });

  await expect(
    openDeliveryDay('http://localhost:3333', courier.id, 8000),
  ).resolves.toEqual(day);
  await expect(
    loadDeliveryDay('http://localhost:3333', day.id),
  ).resolves.toEqual(day);

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/delivery/couriers/courier%2Fid/days',
    {
      body: JSON.stringify({ dailyRateCents: 8000 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:3333/delivery/days/day%2Fid',
  );
});

it('records deliveries and expenses and closes the day', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ day }),
    ok: true,
  });
  const draft = {
    address: 'Rua das Flores, 120',
    customerName: 'Marina',
    feeCents: 500,
    paymentMethod: 'PIX' as const,
    products: 'Pizza calabresa',
    totalCents: 5000,
  };

  await expect(
    recordDelivery('http://localhost:3333', day.id, draft),
  ).resolves.toEqual(day);
  await expect(
    recordDeliveryExpense('http://localhost:3333', day.id, {
      amountCents: 1000,
      description: 'Combustível',
    }),
  ).resolves.toEqual(day);
  await expect(
    closeDeliveryDay('http://localhost:3333', day.id),
  ).resolves.toEqual(day);

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/delivery/days/day%2Fid/deliveries',
    {
      body: JSON.stringify(draft),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:3333/delivery/days/day%2Fid/expenses',
    {
      body: JSON.stringify({ amountCents: 1000, description: 'Combustível' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    3,
    'http://localhost:3333/delivery/days/day%2Fid/close',
    {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
});

it('rejects malformed delivery responses', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ day: { id: 'invalid' } }),
    ok: true,
  });

  await expect(
    loadDeliveryDay('http://localhost:3333', day.id),
  ).rejects.toThrow('Invalid delivery day response');
});
