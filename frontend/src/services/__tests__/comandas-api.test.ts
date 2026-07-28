import {
  addComandaItem,
  cancelComanda,
  changeComandaItemQuantity,
  closeComanda,
  confirmComandaItem,
  loadComanda,
  openComanda,
  removeComandaItem,
} from '../comandas-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  events: [
    {
      createdAt: '2026-06-02T19:00:00.000Z',
      itemId: null,
      newQuantity: null,
      previousQuantity: null,
      productId: null,
      productName: null,
      reason: null,
      type: 'OPENED',
      unitPriceCents: null,
    },
  ],
  id: 'comanda/id',
  items: [
    {
      confirmedQuantity: 0,
      id: 'item/id',
      productId: 'product/id',
      productName: 'Café',
      quantity: 2,
      subtotalCents: 1200,
      unitPriceCents: 600,
    },
  ],
  name: null,
  number: 42,
  openedAt: '2026-06-02T19:00:00.000Z',
  status: 'OPEN',
  table: {
    id: 1,
    number: 1,
  },
  totalCents: 1200,
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

it('opens a comanda for a restaurant table', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(openComanda('http://192.168.0.10:3333/', 1)).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith('http://192.168.0.10:3333/tables/1/comandas', {
    body: JSON.stringify({}),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
});

it('opens a named comanda for a restaurant table', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda: { ...comanda, name: 'João' } }),
    ok: true,
  });

  await expect(
    openComanda('http://192.168.0.10:3333', 1, 'João'),
  ).resolves.toEqual({ ...comanda, name: 'João' });
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/tables/1/comandas',
    {
      body: JSON.stringify({ name: 'João' }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
});

it('loads a comanda by encoded id', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(loadComanda('http://192.168.0.10:3333', 'comanda/id')).resolves.toEqual(
    comanda,
  );
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid',
  );
});

it('cancels a comanda by encoded id', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(
    cancelComanda('http://192.168.0.10:3333', 'comanda/id'),
  ).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid/cancel',
    {
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
});

it('closes a comanda by encoded id', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(
    closeComanda('http://192.168.0.10:3333', 'comanda/id'),
  ).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid/close',
    {
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
});

it('adds a product to a comanda', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(
    addComandaItem('http://192.168.0.10:3333', 'comanda/id', 'product/id'),
  ).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid/items',
    {
      body: JSON.stringify({ productId: 'product/id' }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
});

it('changes a comanda item quantity', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(
    changeComandaItemQuantity('http://192.168.0.10:3333', 'comanda/id', 'item/id', 1),
  ).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid/items/item%2Fid',
    {
      body: JSON.stringify({ delta: 1 }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  );
});

it('confirms a comanda item quantity', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(
    confirmComandaItem('http://192.168.0.10:3333', 'comanda/id', 'item/id'),
  ).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid/items/item%2Fid/confirm',
    {
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
});

it('removes a comanda item', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda }),
    ok: true,
  });

  await expect(
    removeComandaItem('http://192.168.0.10:3333', 'comanda/id', 'item/id'),
  ).resolves.toEqual(comanda);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://192.168.0.10:3333/comandas/comanda%2Fid/items/item%2Fid',
    {
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'DELETE',
    },
  );
});

it('rejects unsuccessful responses', async () => {
  mockFetch.mockResolvedValueOnce({ ok: false });

  await expect(openComanda('http://192.168.0.10:3333', 1)).rejects.toThrow(
    'Comanda request failed',
  );
});

it('rejects malformed responses', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ comanda: { id: 'invalid' } }),
    ok: true,
  });

  await expect(openComanda('http://192.168.0.10:3333', 1)).rejects.toThrow(
    'Invalid comanda response',
  );
});
