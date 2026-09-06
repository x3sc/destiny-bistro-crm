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
