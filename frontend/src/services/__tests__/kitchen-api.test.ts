import {
  loadKitchenTicket,
  loadKitchenTickets,
  updateKitchenTicketStatus,
} from '../kitchen-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

const ticket = {
  comandaId: 'comanda-id',
  comandaNumber: 32,
  createdAt: '2026-09-01T15:00:00.000Z',
  id: 'ticket-id',
  items: [
    {
      comandaItemId: 'item-id',
      configurations: [
        {
          additionals: [
            {
              additionalId: 'bacon-id',
              additionalName: 'Bacon',
              id: 'ticket-additional-id',
              quantityPerUnit: 1,
            },
          ],
          configurationKey: 'with-bacon',
          id: 'ticket-configuration-id',
          quantity: 2,
        },
      ],
      id: 'ticket-item-id',
      productId: 'burger-id',
      productName: 'Hambúrguer',
      quantity: 2,
    },
  ],
  status: 'PENDING' as const,
  table: { id: 8, number: 8 },
  updatedAt: '2026-09-01T15:00:00.000Z',
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

it('loads the operational kitchen queue and a tenant ticket', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ tickets: [ticket] }),
      ok: true,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ ticket }),
      ok: true,
    });

  await expect(loadKitchenTickets('http://localhost:3333/')).resolves.toEqual([
    ticket,
  ]);
  await expect(
    loadKitchenTicket('http://localhost:3333', 'ticket-id'),
  ).resolves.toEqual(ticket);
});

it('updates status with the explicit patch contract', async () => {
  const preparing = { ...ticket, status: 'PREPARING' as const };
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ ticket: preparing }),
    ok: true,
  });

  await expect(
    updateKitchenTicketStatus(
      'http://localhost:3333',
      'ticket-id',
      'PREPARING',
    ),
  ).resolves.toEqual(preparing);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/kitchen/tickets/ticket-id/status',
    {
      body: JSON.stringify({ status: 'PREPARING' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  );
});

it('rejects malformed kitchen snapshots', async () => {
  const invalid = {
    ...ticket,
    items: [{ ...ticket.items[0], configurations: [] }],
    status: 'UNKNOWN',
  };
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ tickets: [invalid] }),
    ok: true,
  });

  await expect(loadKitchenTickets('http://localhost:3333')).rejects.toThrow(
    'Invalid kitchen tickets response',
  );
});
