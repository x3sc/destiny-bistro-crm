import { cancelComanda, loadComanda, openComanda } from '../comandas-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const comanda = {
  cancellationReason: null,
  cancelledAt: null,
  events: [
    {
      createdAt: '2026-06-02T19:00:00.000Z',
      reason: null,
      type: 'OPENED',
    },
  ],
  id: 'comanda/id',
  number: 42,
  openedAt: '2026-06-02T19:00:00.000Z',
  status: 'OPEN',
  table: {
    id: 1,
    number: 1,
  },
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
    method: 'POST',
  });
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
      method: 'POST',
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
