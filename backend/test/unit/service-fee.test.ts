import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutSummary, parseCheckoutOptions, serviceFeeCents } from '../../src/service-fee.js';
import type { Comanda } from '../../src/comanda-types.js';

void test('service fee rounds once in integer cents, half up, and validates monetary bounds', () => {
  assert.equal(serviceFeeCents(10000, 10), 1000);
  assert.equal(serviceFeeCents(14, 10), 1);
  assert.equal(serviceFeeCents(15, 10), 2);
  assert.equal(serviceFeeCents(19, 0), 0);
  assert.throws(() => serviceFeeCents(-1, 10));
  assert.throws(() => serviceFeeCents(1.5, 10));
  assert.throws(() => serviceFeeCents(100, 20));
  assert.throws(() => serviceFeeCents(2147483647, 10));
});

void test('modern checkout requires a complete trusted quote and rejects client-defined fee amounts', () => {
  const input = { includeServiceFee: true, requestId: 'checkout-test-001', expectedSnapshot: 'a'.repeat(64), payments: [] };
  assert.equal(parseCheckoutOptions({ payments: [] }), undefined);
  assert.deepEqual(parseCheckoutOptions(input), { includeServiceFee: true, requestId: input.requestId, expectedSnapshot: input.expectedSnapshot });
  for (const invalid of [{ ...input, serviceFeePercent: 20 }, { ...input, serviceFeeAmountCents: 0 },
    { ...input, includeServiceFee: 'true' }, { ...input, expectedSnapshot: 'stale' }, { payments: [], includeServiceFee: true }]) {
    assert.throws(() => parseCheckoutOptions(invalid));
  }
});

void test('checkout summary includes confirmed additionals, excludes pending quantities and binds prices in its snapshot', () => {
  const comanda: Comanda = { id: 'quote', number: 1, name: null, table: { id: 1, number: 1 }, operationalOrigin: 'TABLE',
    status: 'OPEN', credit: null, cancellationReason: null, cancelledAt: null, closedAt: null,
    openedAt: '2026-10-17T12:00:00Z', events: [], payments: [], totalCents: 5055,
    items: [{ id: 'item', productId: 'product', productName: 'Produto', createdAt: '2026-10-17T12:00:00Z',
      quantity: 3, confirmedQuantity: 2, unitPriceCents: 1015, additionalTotalCents: 2010, subtotalCents: 5055,
      configurations: [{ id: 'config', configurationKey: 'config', quantity: 3, confirmedQuantity: 2, subtotalCents: 5055,
        additionals: [{ id: 'extra', additionalId: 'extra-product', additionalName: 'Adicional', quantityPerUnit: 2, unitPriceCents: 335 }] }] }],
  };
  const quote = checkoutSummary(comanda);
  assert.equal(quote.subtotalCents, 3370); assert.equal(quote.serviceFee.amountCents, 337);
  assert.equal(quote.totalWithServiceFeeCents, 3707); assert.equal(quote.canClose, false);
  comanda.items[0].configurations[0].additionals[0].unitPriceCents = 336;
  assert.notEqual(checkoutSummary(comanda).expectedSnapshot, quote.expectedSnapshot);
  for (const operationalOrigin of ['COUNTER', 'DELIVERY', 'CREDIT'] as const) {
    const excluded = checkoutSummary({ ...comanda, operationalOrigin });
    assert.equal(excluded.eligible, false); assert.equal(excluded.serviceFee.amountCents, 0);
  }
});
