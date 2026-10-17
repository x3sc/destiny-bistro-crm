import { loadTodayDashboard } from '../dashboard-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

it('loads nullable authorized metrics for the Sao Paulo operational day', async () => {
  mockFetch.mockResolvedValueOnce({
    json: async () => ({
      today: {
        closedSalesCents: 12_500,
        date: '2026-09-29',
        occupiedTables: 4,
        pendingKitchenTickets: null,
      },
    }),
    ok: true,
  });

  await expect(
    loadTodayDashboard('http://localhost:3333/'),
  ).resolves.toEqual({
    closedSalesCents: 12_500,
    date: '2026-09-29',
    occupiedTables: 4,
    pendingKitchenTickets: null,
  });
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/dashboard/today',
  );
});

it('rejects malformed or unavailable dashboard responses', async () => {
  mockFetch.mockResolvedValueOnce({
    json: async () => ({ today: { occupiedTables: '4' } }),
    ok: true,
  });
  await expect(
    loadTodayDashboard('http://localhost:3333'),
  ).rejects.toThrow('Invalid dashboard response');

  mockFetch.mockResolvedValueOnce({ ok: false });
  await expect(
    loadTodayDashboard('http://localhost:3333'),
  ).rejects.toThrow('Dashboard request failed');
});
