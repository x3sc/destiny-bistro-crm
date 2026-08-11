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
      creditBalanceAfterCents: 500,
      creditPaidAfterCents: 0,
      creditPaidBeforeCents: 0,
      creditTotalCents: 500,
      customerName: 'Maria',
      deliveryAddress: null,
      deliveryFeeCents: null,
      event: 'CREDIT_FINALIZED',
      id: 'entry-id',
      items: [
        {
          productId: 'product-id',
          productName: 'Café',
          quantity: 1,
          unitPriceCents: 500,
        },
      ],
      occurredAt: '2026-07-28T13:00:00.000Z',
      origin: 'CREDIT_MANUAL',
      payments: [],
      paymentOrigin: null,
      receivedCents: 0,
      receivedItemCount: 0,
      soldCents: 500,
      soldItemCount: 1,
      status: 'OPEN',
      tableNumber: null,
      tableCheckoutPaidCents: 0,
    },
  ],
  indicators: {
    averageTicketCents: 2500,
    differenceCents: 500,
    originSummaries: [
      {
        movementCount: 1,
        origin: 'CREDIT_MANUAL',
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 500,
        soldItemCount: 1,
      },
    ],
    paymentMethodSummaries: [
      { method: 'CASH', receivedCents: 500 },
      { method: 'PIX', receivedCents: 400 },
      { method: 'DEBIT_CARD', receivedCents: 300 },
      { method: 'CREDIT_CARD', receivedCents: 200 },
      { method: 'UNSPECIFIED', receivedCents: 600 },
    ],
    saleCommandCount: 1,
  },
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

it('builds encoded PDF export URLs for both views', () => {
  expect(
    statementPdfUrl(
      'http://localhost:3333/',
      '2026-07-28',
      '2026-07-30',
      'summary',
    ),
  ).toBe(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30&view=summary',
  );
  expect(
    statementPdfUrl(
      'http://localhost:3333/',
      '2026-07-28',
      '2026-07-30',
      'detailed',
    ),
  ).toBe(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30&view=detailed',
  );
  expect(
    statementPdfUrl(
      'http://localhost:3333/',
      '2026-07-28',
      '2026-07-30',
      'detailed',
      { movementType: 'RECEIPTS', origin: 'CREDIT_MANUAL' },
    ),
  ).toBe(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30&view=detailed&movementType=RECEIPTS&origin=CREDIT_MANUAL',
  );
});

it('rejects invalid credit balances', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({
      statement: {
        ...statement,
        entries: [
          { ...statement.entries[0], creditBalanceAfterCents: -1 },
        ],
      },
    }),
    ok: true,
  });

  await expect(
    loadStatement('http://localhost:3333', '2026-07-28', '2026-07-28'),
  ).rejects.toThrow('Resposta inválida da API de extratos.');
});

it('rejects invalid credit payment context', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({
      statement: {
        ...statement,
        entries: [{ ...statement.entries[0], paymentOrigin: 'OTHER' }],
      },
    }),
    ok: true,
  });

  await expect(
    loadStatement('http://localhost:3333', '2026-07-28', '2026-07-28'),
  ).rejects.toThrow('Resposta inválida da API de extratos.');
});

it('rejects invalid payment method summaries', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({
      statement: {
        ...statement,
        indicators: {
          ...statement.indicators,
          paymentMethodSummaries: [{ method: 'CHEQUE', receivedCents: 2000 }],
        },
      },
    }),
    ok: true,
  });

  await expect(
    loadStatement('http://localhost:3333', '2026-07-28', '2026-07-28'),
  ).rejects.toThrow('Resposta inválida da API de extratos.');
});

it('rejects payment method summaries that do not reconcile with receipts', async () => {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({
      statement: {
        ...statement,
        indicators: {
          ...statement.indicators,
          paymentMethodSummaries: statement.indicators.paymentMethodSummaries.map(
            (summary) =>
              summary.method === 'CASH'
                ? { ...summary, receivedCents: summary.receivedCents + 1 }
                : summary,
          ),
        },
      },
    }),
    ok: true,
  });

  await expect(
    loadStatement('http://localhost:3333', '2026-07-28', '2026-07-28'),
  ).rejects.toThrow('Resposta inválida da API de extratos.');
});
