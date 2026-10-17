import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildComandaPrintDocument,
  PrintDocumentEmptyError,
  type ComandaPrintSource,
} from "../../src/comanda-print-document.js";

const source: ComandaPrintSource = {
  deliveryFeeCents: 500,
  establishmentName: "Destiny Bistro",
  id: "comanda-id",
  items: [
    {
      configurations: [
        {
          additionals: [
            { additionalName: "Bacon", quantityPerUnit: 2, unitPriceCents: 300 },
          ],
          confirmedQuantity: 2,
          quantity: 3,
        },
        { additionals: [], confirmedQuantity: 0, quantity: 1 },
      ],
      productName: "X-Burger",
      requiresKitchen: true,
      unitPriceCents: 2_000,
    },
    {
      configurations: [
        { additionals: [], confirmedQuantity: 1, quantity: 2 },
      ],
      productName: "Refrigerante",
      requiresKitchen: false,
      unitPriceCents: 600,
    },
  ],
  name: "Cliente",
  number: 42,
  openedAt: new Date("2026-09-03T18:00:00.000Z"),
  status: "OPEN",
  tableNumber: null,
};

void test('counter receipts identify externally recorded payments only after closing', () => {
  const counter = { ...source, tableName: 'Balcão', tableNumber: null, deliveryFeeCents: null };
  const closed = buildComandaPrintDocument({ ...counter, status: 'CLOSED' }, 'CONFIRMED', 'Operator');
  assert.equal(closed.externalPaymentMethod, 'COUNTER');
  const opened = buildComandaPrintDocument({ ...counter, status: 'OPEN' }, 'CONFIRMED', 'Operator');
  assert.equal(opened.externalPaymentMethod, undefined);
});

void test("builds the confirmed comanda document with values and delivery fee", () => {
  const document = buildComandaPrintDocument(
    source,
    "CONFIRMED",
    "Operador",
    new Date("2026-09-03T18:30:00.000Z"),
  );

  assert.equal(document.kind, "CONFIRMED");
  assert.equal(document.destination, "DELIVERY");
  assert.equal(document.deliveryFeeCents, 500);
  assert.equal(document.totalCents, 6_300);
  assert.deepEqual(document.items, [
    {
      additionals: [{ name: "Bacon", quantityPerUnit: 2, unitPriceCents: 300 }],
      productName: "X-Burger",
      quantity: 2,
      subtotalCents: 5_200,
      unitPriceCents: 2_600,
    },
    {
      additionals: [],
      productName: "Refrigerante",
      quantity: 1,
      subtotalCents: 600,
      unitPriceCents: 600,
    },
  ]);
});

void test("builds the pending kitchen document from kitchen snapshots only", () => {
  const document = buildComandaPrintDocument(
    source,
    "KITCHEN_PENDING",
    "Operador",
    new Date("2026-09-03T18:30:00.000Z"),
  );

  assert.equal(document.kind, "KITCHEN_PENDING");
  assert.equal(document.totalCents, null);
  assert.deepEqual(document.items, [
    {
      additionals: [{ name: "Bacon", quantityPerUnit: 2, unitPriceCents: null }],
      productName: "X-Burger",
      quantity: 1,
      subtotalCents: null,
      unitPriceCents: null,
    },
    {
      additionals: [],
      productName: "X-Burger",
      quantity: 1,
      subtotalCents: null,
      unitPriceCents: null,
    },
  ]);
});

void test("rejects documents without printable lines", () => {
  assert.throws(
    () => buildComandaPrintDocument({ ...source, items: [] }, "CONFIRMED", "Operador"),
    PrintDocumentEmptyError,
  );
});


const counterSource: ComandaPrintSource = { ...source, tableName: 'Balcão', deliveryFeeCents: null };

void test('counter pending includes every undelivered configuration with prices, including non-kitchen products', () => {
  const before = structuredClone(counterSource);
  const document = buildComandaPrintDocument(counterSource, 'COUNTER_PENDING', 'Operador');
  assert.equal(document.kind, 'COUNTER_PENDING');
  assert.equal(document.destination, 'COUNTER');
  assert.deepEqual(document.items.map(({ productName, quantity, subtotalCents }) => ({ productName, quantity, subtotalCents })), [
    { productName: 'X-Burger', quantity: 1, subtotalCents: 2600 },
    { productName: 'X-Burger', quantity: 1, subtotalCents: 2000 },
    { productName: 'Refrigerante', quantity: 1, subtotalCents: 600 },
  ]);
  assert.equal(document.totalCents, 5200);
  assert.equal(document.serviceFee, undefined);
  assert.equal(document.items[0].additionals[0].unitPriceCents, 300);
  assert.deepEqual(counterSource, before);
});

void test('counter final refuses pending, empty, cancelled and unrelated sales', () => {
  assert.throws(() => buildComandaPrintDocument(counterSource, 'COUNTER_FINAL', 'Operador'));
  for (const kind of ['COUNTER_PENDING', 'COUNTER_FINAL'] as const) {
    for (const invalid of [source, { ...counterSource, status: 'CANCELLED' as const },
      { ...counterSource, status: 'CLOSED' as const }, { ...counterSource, items: [] }]) {
      assert.throws(() => buildComandaPrintDocument(invalid, kind, 'Operador'));
    }
  }
});

void test('counter final includes delivered totals and current fees; new orders block it again', () => {
  const delivered = { ...counterSource, items: counterSource.items.map((item) => ({ ...item,
    configurations: item.configurations.map((configuration) => ({ ...configuration, confirmedQuantity: configuration.quantity })),
  })), serviceFeeApplied: true, serviceFeePercent: 10, serviceFeeSubtotalCents: 11000, serviceFeeAmountCents: 1100 };
  const document = buildComandaPrintDocument(delivered, 'COUNTER_FINAL', 'Operador');
  assert.equal(document.totalCents, 12100);
  assert.equal(document.serviceFee?.amountCents, 1100);
  assert.equal(document.externalPaymentMethod, undefined);
  assert.throws(() => buildComandaPrintDocument(delivered, 'COUNTER_PENDING', 'Operador'), PrintDocumentEmptyError);
  const next = { ...delivered, items: [...delivered.items, { ...delivered.items[1], configurations: [
    { additionals: [], quantity: 1, confirmedQuantity: 0 },
  ] }] };
  assert.throws(() => buildComandaPrintDocument(next, 'COUNTER_FINAL', 'Operador'));
  const pending = buildComandaPrintDocument(next, 'COUNTER_PENDING', 'Operador');
  assert.equal(pending.totalCents, 600);
  assert.equal(pending.serviceFee, undefined);
});
