import { loadStatement, statementPdfUrl } from '../statements-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const statement = {
  days: [
    {
      cancelledCommandCount: 0,
      closedCommandCount: 1,
      date: '2026-07-28',
      processedCommandCount: 1,
      receivedCents: 2000,
      receivedItemCount: 2,
      soldCents: 2500,
      soldItemCount: 3,
    },
  ],
  entries: [
    {
      comandaId: 'comanda-id',
      comandaName: 'Maria',
      comandaNumber: 42,
      event: 'CREDIT_FINALIZED',
      id: 'entry-id',
      occurredAt: '2026-07-28T13:00:00.000Z',
      origin: 'CREDIT_MANUAL',
      receivedCents: 0,
      receivedItemCount: 0,
      soldCents: 500,
      soldItemCount: 1,
      status: 'OPEN',
      tableNumber: null,
    },
  ],
  period: {
    from: '2026-07-28',
    timeZone: 'America/Sao_Paulo',
    to: '2026-07-28',
  },
  summary: {
    cancelledCommandCount: 0,
    closedCommandCount: 1,
    processedCommandCount: 1,
    receivedCents: 2000,
    receivedItemCount: 2,
    soldCents: 2500,
    soldItemCount: 3,
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

it('loads a validated statement period', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ statement }),
    ok: true,
  });

  await expect(
    loadStatement('http://localhost:3333/', '2026-07-28', '2026-07-30'),
  ).resolves.toEqual(statement);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/statements?from=2026-07-28&to=2026-07-30',
  );
});

it('rejects invalid statement responses', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ statement: { summary: {} } }),
    ok: true,
  });

  await expect(
    loadStatement('http://localhost:3333', '2026-07-28', '2026-07-28'),
  ).rejects.toThrow('Resposta inválida da API de extratos.');
});

it('builds an encoded PDF export URL', () => {
  expect(
    statementPdfUrl(
      'http://localhost:3333/',
      '2026-07-28',
      '2026-07-30',
    ),
  ).toBe(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30',
  );
});
