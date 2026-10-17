import { completeCounterSale, CounterSaleConflictError, loadCounterSales, openCounterSale } from '../counter-sales-api';
import { authenticatedFetch } from '../auth-session';
import type { Comanda } from '../comandas-api';

jest.mock('../auth-session', () => ({ authenticatedFetch: jest.fn() }));
const request = jest.mocked(authenticatedFetch);
const sale: Comanda = { id: 'counter', name: null, number: 12, table: null, tableName: 'Balcão', status: 'OPEN',
  counterSnapshot: 'a'.repeat(64), openedAt: '2026-10-16T12:00:00.000Z', closedAt: null, cancelledAt: null,
  cancellationReason: null, credit: null, payments: [], events: [], items: [], totalCents: 500 };
const reply = (body: object, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
beforeEach(() => request.mockReset());

it('opens without names or financial input and validates that the response belongs to Balcão', async () => {
  request.mockResolvedValueOnce(reply({ comanda: sale }));
  await openCounterSale('http://localhost:3333', 'open-key-01');
  expect(request).toHaveBeenCalledWith('http://localhost:3333/counter-sales', expect.objectContaining({ method: 'POST', body: JSON.stringify({ requestId: 'open-key-01' }) }));
  request.mockResolvedValueOnce(reply({ comanda: { ...sale, tableName: 'Venda rápida' } }));
  await expect(openCounterSale('http://localhost:3333', 'open-key-02')).rejects.toThrow();
});

it('sends only operation identity and expected snapshot, and requires a real server confirmation', async () => {
  request.mockResolvedValueOnce(reply({ comanda: { ...sale, status: 'CLOSED', payments: [{
    id: 'payment', comandaId: sale.id, creditOrderId: null, recordedBy: null, paidAt: sale.openedAt,
    amountCents: 500, origin: 'COUNTER_CHECKOUT', allocations: [{ id: 'allocation', method: 'COUNTER', amountCents: 500 }],
  }] } }));
  await completeCounterSale('http://localhost:3333', 'counter', 'close-key-01', sale.counterSnapshot!);
  expect(request).toHaveBeenCalledWith('http://localhost:3333/counter-sales/counter/complete', expect.objectContaining({
    body: JSON.stringify({ requestId: 'close-key-01', expectedSnapshot: sale.counterSnapshot }),
  }));
  request.mockResolvedValueOnce(reply({ comanda: sale }));
  await expect(completeCounterSale('http://localhost:3333', 'counter', 'close-key-01', sale.counterSnapshot!)).rejects.toThrow();
  request.mockResolvedValueOnce(reply({}, 409));
  await expect(completeCounterSale('http://localhost:3333', 'counter', 'close-key-01', sale.counterSnapshot!)).rejects.toBeInstanceOf(CounterSaleConflictError);
});

it('scopes completed list requests to the selected day and rejects foreign classifications', async () => {
  request.mockResolvedValueOnce(reply({ comandas: [sale] }));
  await loadCounterSales('http://localhost:3333', 'CLOSED', '2026-10-15');
  expect(request).toHaveBeenCalledWith('http://localhost:3333/counter-sales?status=CLOSED&date=2026-10-15');
  request.mockResolvedValueOnce(reply({ comandas: [{ ...sale, table: { id: 1, number: 1 } }] }));
  await expect(loadCounterSales('http://localhost:3333', 'OPEN', '2026-10-15')).rejects.toThrow();
});
