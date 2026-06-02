import { loadTables } from '../tables-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = mockFetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  mockFetch.mockReset();
});

it('loads tables from a normalized API URL', async () => {
  const tables = [{ activeComanda: null, id: 1, number: 1, status: 'FREE' }];
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ tables }),
    ok: true,
  });

  await expect(loadTables('http://192.168.0.10:3333/')).resolves.toEqual(tables);
  expect(mockFetch).toHaveBeenCalledWith('http://192.168.0.10:3333/tables');
});

it('rejects unsuccessful responses', async () => {
  mockFetch.mockResolvedValueOnce({ ok: false });

  await expect(loadTables('http://192.168.0.10:3333')).rejects.toThrow(
    'Tables request failed',
  );
});

it('rejects malformed responses', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        tables: [{ activeComanda: null, id: 1, number: '1', status: 'FREE' }],
      }),
    ok: true,
  });

  await expect(loadTables('http://192.168.0.10:3333')).rejects.toThrow(
    'Invalid tables response',
  );
});
