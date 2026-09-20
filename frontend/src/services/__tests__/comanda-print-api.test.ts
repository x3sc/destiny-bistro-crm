import { loadComandaPrintDocument } from '../comanda-print-api';

const mockFetch = jest.fn();

jest.mock('../auth-session', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

beforeEach(() => mockFetch.mockReset());

it('loads and validates a confirmed print document', async () => {
  mockFetch.mockResolvedValue({
    json: async () => ({
      document: {
        comandaId: 'comanda-id',
        comandaName: null,
        comandaNumber: 42,
        deliveryFeeCents: null,
        destination: 'TABLE',
        establishmentName: 'Destiny Bistro',
        generatedAt: '2026-09-03T18:30:00.000Z',
        generatedBy: 'Operador',
        items: [{
          additionals: [],
          productName: 'Burger',
          quantity: 1,
          subtotalCents: 2000,
          unitPriceCents: 2000,
        }],
        kind: 'CONFIRMED',
        openedAt: '2026-09-03T18:00:00.000Z',
        status: 'OPEN',
        tableNumber: 1,
        totalCents: 2000,
      },
    }),
    ok: true,
    status: 200,
  });

  const document = await loadComandaPrintDocument(
    'http://localhost:3333/',
    'comanda-id',
    'CONFIRMED',
  );
  expect(document.kind).toBe('CONFIRMED');
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/comandas/comanda-id/print-document?kind=CONFIRMED',
  );
});

it('reports an empty kitchen document clearly', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 409 });
  await expect(
    loadComandaPrintDocument('http://localhost:3333', 'comanda-id', 'KITCHEN_PENDING'),
  ).rejects.toThrow('Não há itens pendentes de cozinha para imprimir.');
});
