import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateDayPayoutCents,
  DeliveryCourierNameError,
  DeliveryInputError,
  normalizeCourierName,
  normalizeDeliveryInput,
  normalizeExpenseInput,
} from "../../src/delivery-types.js";

void test("courier payout adds the daily rate to fees and deducts expenses", () => {
  assert.equal(
    calculateDayPayoutCents({
      dailyRateCents: 8_000,
      expensesTotalCents: 5_000,
      feesTotalCents: 3_500,
    }),
    6_500,
  );
});

void test("courier payout can go negative when expenses exceed earnings", () => {
  assert.equal(
    calculateDayPayoutCents({
      dailyRateCents: 5_000,
      expensesTotalCents: 9_000,
      feesTotalCents: 1_000,
    }),
    -3_000,
  );
});

void test("courier names are trimmed and normalized for duplicate detection", () => {
  assert.deepEqual(normalizeCourierName("  Joao   da Silva "), {
    name: "Joao da Silva",
    normalizedName: "joao da silva",
  });
});

void test("courier names reject empty and oversized values", () => {
  assert.throws(() => normalizeCourierName("   "), DeliveryCourierNameError);
  assert.throws(
    () => normalizeCourierName("a".repeat(81)),
    DeliveryCourierNameError,
  );
  assert.throws(() => normalizeCourierName(42), DeliveryCourierNameError);
});

void test("deliveries normalize text fields and keep cents as integers", () => {
  assert.deepEqual(
    normalizeDeliveryInput({
      address: "  Rua   das Flores, 120 ",
      customerName: "  Marina  Souza ",
      feeCents: 500,
      paymentMethod: "PIX",
      products: "  Pizza  calabresa ",
      totalCents: 5_000,
    }),
    {
      address: "Rua das Flores, 120",
      customerName: "Marina Souza",
      feeCents: 500,
      paymentMethod: "PIX",
      products: "Pizza calabresa",
      totalCents: 5_000,
    },
  );
});

void test("delivery products are optional and blank values become null", () => {
  assert.equal(
    normalizeDeliveryInput({
      address: "Rua A, 1",
      customerName: "Cliente",
      feeCents: 0,
      paymentMethod: "CASH",
      products: "   ",
      totalCents: 1_000,
    }).products,
    null,
  );
  assert.equal(
    normalizeDeliveryInput({
      address: "Rua A, 1",
      customerName: "Cliente",
      feeCents: 0,
      paymentMethod: "CASH",
      totalCents: 1_000,
    }).products,
    null,
  );
});

void test("deliveries reject invalid totals, fees and payment methods", () => {
  const valid = {
    address: "Rua A, 1",
    customerName: "Cliente",
    feeCents: 500,
    paymentMethod: "CASH",
    totalCents: 1_000,
  };

  assert.throws(
    () => normalizeDeliveryInput({ ...valid, totalCents: 0 }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeDeliveryInput({ ...valid, totalCents: -100 }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeDeliveryInput({ ...valid, totalCents: 10.5 }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeDeliveryInput({ ...valid, feeCents: -1 }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeDeliveryInput({ ...valid, paymentMethod: "BITCOIN" }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeDeliveryInput({ ...valid, customerName: "  " }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeDeliveryInput({ ...valid, address: "a".repeat(256) }),
    DeliveryInputError,
  );
});

void test("expenses require a description and a positive amount", () => {
  assert.deepEqual(
    normalizeExpenseInput({ amountCents: 5_000, description: "  Gasolina " }),
    { amountCents: 5_000, description: "Gasolina" },
  );
  assert.throws(
    () => normalizeExpenseInput({ amountCents: 0, description: "Gasolina" }),
    DeliveryInputError,
  );
  assert.throws(
    () => normalizeExpenseInput({ amountCents: 5_000, description: "  " }),
    DeliveryInputError,
  );
});
