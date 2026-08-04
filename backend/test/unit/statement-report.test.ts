import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStatementReport,
  filterStatementEntries,
  parseStatementPeriod,
  type StatementSourceData,
} from "../../src/statement-report.js";

void test("statement periods use inclusive Sao Paulo calendar dates", () => {
  const period = parseStatementPeriod("2026-07-28", "2026-07-28");

  assert.equal(period.from, "2026-07-28");
  assert.equal(period.to, "2026-07-28");
  assert.equal(period.startAt.toISOString(), "2026-07-28T03:00:00.000Z");
  assert.equal(period.endAt.toISOString(), "2026-07-29T03:00:00.000Z");
});

void test("statement periods reject missing, invalid and inverted dates", () => {
  assert.throws(() => parseStatementPeriod(undefined, "2026-07-28"));
  assert.throws(() => parseStatementPeriod("2026-02-30", "2026-03-01"));
  assert.throws(() => parseStatementPeriod("2026-07-29", "2026-07-28"));
});

void test("statements separate sales, later credit additions and receipts", () => {
  const period = parseStatementPeriod("2026-07-28", "2026-07-30");
  const source: StatementSourceData = {
    cancelledComandas: [
      {
        cancelledAt: new Date("2026-07-29T16:00:00.000Z"),
        creditOrder: null,
        id: "cancelled",
        items: [
          {
            confirmedQuantity: 0,
            productId: "cancelled-product",
            productName: "Item cancelado",
            quantity: 1,
            unitPriceCents: 700,
          },
        ],
        name: "Cancelada",
        number: 13,
        status: "CANCELLED",
        tableNumber: 3,
      },
    ],
    closedComandas: [
      {
        closedAt: new Date("2026-07-28T12:00:00.000Z"),
        creditOrder: null,
        id: "table",
        items: [
          {
            confirmedQuantity: 2,
            productId: "lunch-product",
            productName: "Almoço",
            quantity: 2,
            unitPriceCents: 1_000,
          },
        ],
        name: "Almoço",
        number: 11,
        status: "CLOSED",
        tableNumber: 1,
      },
      {
        closedAt: new Date("2026-07-30T15:00:00.000Z"),
        creditOrder: {
          customerName: "Maria",
          settlementAmountCents: 1_500,
          source: "MANUAL",
        },
        id: "credit",
        items: [
          {
            confirmedQuantity: 3,
            productId: "credit-product",
            productName: "Café",
            quantity: 3,
            unitPriceCents: 500,
          },
        ],
        name: "Maria",
        number: 12,
        status: "CLOSED",
        tableNumber: null,
      },
    ],
    creditOrders: [
      {
        comanda: {
          events: [
            {
              createdAt: new Date("2026-07-28T12:30:00.000Z"),
              newQuantity: 1,
              previousQuantity: 0,
              productId: "credit-product",
              productName: "Café",
              unitPriceCents: 500,
            },
            {
              createdAt: new Date("2026-07-29T14:00:00.000Z"),
              newQuantity: 3,
              previousQuantity: 1,
              productId: "credit-product",
              productName: "Café",
              unitPriceCents: 500,
            },
          ],
          id: "credit",
          name: "Maria",
          number: 12,
          status: "CLOSED",
          tableNumber: null,
        },
        customerName: "Maria",
        finalizedAt: new Date("2026-07-28T13:00:00.000Z"),
        source: "MANUAL",
      },
    ],
  };

  const report = buildStatementReport(period, source);

  assert.deepEqual(report.summary, {
    cancelledCommandCount: 1,
    closedCommandCount: 2,
    processedCommandCount: 3,
    receivedCents: 3_500,
    receivedItemCount: 5,
    soldCents: 3_500,
    soldItemCount: 5,
  });
  assert.deepEqual(report.indicators, {
    averageTicketCents: 1_750,
    differenceCents: 0,
    originSummaries: [
      {
        movementCount: 2,
        origin: "TABLE",
        receivedCents: 2_000,
        receivedItemCount: 2,
        soldCents: 2_000,
        soldItemCount: 2,
      },
      {
        movementCount: 3,
        origin: "CREDIT_MANUAL",
        receivedCents: 1_500,
        receivedItemCount: 3,
        soldCents: 1_500,
        soldItemCount: 3,
      },
      {
        movementCount: 0,
        origin: "CREDIT_TABLE",
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
    ],
    paymentMethodSummaries: [
      { method: "CASH", receivedCents: 0 },
      { method: "PIX", receivedCents: 0 },
      { method: "DEBIT_CARD", receivedCents: 0 },
      { method: "CREDIT_CARD", receivedCents: 0 },
      { method: "UNSPECIFIED", receivedCents: 3_500 },
    ],
    saleCommandCount: 2,
  });
  assert.deepEqual(
    report.days.map((day) => ({
      cancelled: day.cancelledCommandCount,
      closed: day.closedCommandCount,
      date: day.date,
      received: day.receivedCents,
      receivedItems: day.receivedItemCount,
      sold: day.soldCents,
      soldItems: day.soldItemCount,
    })),
    [
      {
        cancelled: 0,
        closed: 1,
        date: "2026-07-28",
        received: 2_000,
        receivedItems: 2,
        sold: 2_500,
        soldItems: 3,
      },
      {
        cancelled: 1,
        closed: 0,
        date: "2026-07-29",
        received: 0,
        receivedItems: 0,
        sold: 1_000,
        soldItems: 2,
      },
      {
        cancelled: 0,
        closed: 1,
        date: "2026-07-30",
        received: 1_500,
        receivedItems: 3,
        sold: 0,
        soldItems: 0,
      },
    ],
  );
  assert.deepEqual(
    report.entries.map((entry) => entry.event),
    [
      "TABLE_CLOSED",
      "CREDIT_FINALIZED",
      "CREDIT_ADDITION",
      "COMANDA_CANCELLED",
      "CREDIT_SETTLED",
    ],
  );
  assert.deepEqual(
    report.entries.map((entry) => ({
      customerName: entry.customerName,
      event: entry.event,
      items: entry.items,
    })),
    [
      {
        customerName: null,
        event: "TABLE_CLOSED",
        items: [
          {
            productId: "lunch-product",
            productName: "Almoço",
            quantity: 2,
            unitPriceCents: 1_000,
          },
        ],
      },
      {
        customerName: "Maria",
        event: "CREDIT_FINALIZED",
        items: [
          {
            productId: "credit-product",
            productName: "Café",
            quantity: 1,
            unitPriceCents: 500,
          },
        ],
      },
      {
        customerName: "Maria",
        event: "CREDIT_ADDITION",
        items: [
          {
            productId: "credit-product",
            productName: "Café",
            quantity: 2,
            unitPriceCents: 500,
          },
        ],
      },
      {
        customerName: null,
        event: "COMANDA_CANCELLED",
        items: [
          {
            productId: "cancelled-product",
            productName: "Item cancelado",
            quantity: 1,
            unitPriceCents: 700,
          },
        ],
      },
      {
        customerName: "Maria",
        event: "CREDIT_SETTLED",
        items: [
          {
            productId: "credit-product",
            productName: "Café",
            quantity: 3,
            unitPriceCents: 500,
          },
        ],
      },
    ],
  );
});

void test("empty statement periods return zero totals and every selected day", () => {
  const period = parseStatementPeriod("2026-07-28", "2026-07-29");
  const report = buildStatementReport(period, {
    cancelledComandas: [],
    closedComandas: [],
    creditOrders: [],
  });

  assert.equal(report.summary.processedCommandCount, 0);
  assert.deepEqual(report.indicators, {
    averageTicketCents: 0,
    differenceCents: 0,
    originSummaries: [
      {
        movementCount: 0,
        origin: "TABLE",
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
      {
        movementCount: 0,
        origin: "CREDIT_MANUAL",
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
      {
        movementCount: 0,
        origin: "CREDIT_TABLE",
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
    ],
    paymentMethodSummaries: [
      { method: "CASH", receivedCents: 0 },
      { method: "PIX", receivedCents: 0 },
      { method: "DEBIT_CARD", receivedCents: 0 },
      { method: "CREDIT_CARD", receivedCents: 0 },
      { method: "UNSPECIFIED", receivedCents: 0 },
    ],
    saleCommandCount: 0,
  });
  assert.deepEqual(
    report.days.map((day) => day.date),
    ["2026-07-28", "2026-07-29"],
  );
  assert.deepEqual(report.entries, []);
});

void test("statement difference can be negative when receipts exceed period sales", () => {
  const period = parseStatementPeriod("2026-07-30", "2026-07-30");
  const report = buildStatementReport(period, {
    cancelledComandas: [],
    closedComandas: [
      {
        closedAt: new Date("2026-07-30T15:00:00.000Z"),
        creditOrder: {
          customerName: "Maria",
          settlementAmountCents: 1_500,
          source: "MANUAL",
        },
        id: "credit",
        items: [
          {
            confirmedQuantity: 3,
            productId: "coffee",
            productName: "Café",
            quantity: 3,
            unitPriceCents: 500,
          },
        ],
        name: "Maria",
        number: 12,
        status: "CLOSED",
        tableNumber: null,
      },
    ],
    creditOrders: [],
  });

  assert.equal(report.indicators.differenceCents, -1_500);
  assert.equal(report.indicators.averageTicketCents, 0);
  assert.equal(report.indicators.saleCommandCount, 0);
});

void test("statements reconcile mixed and unspecified credit payment methods", () => {
  const period = parseStatementPeriod("2026-08-01", "2026-08-01");
  const finalPaymentAt = new Date("2026-08-01T15:00:00.000Z");
  const report = buildStatementReport(period, {
    cancelledComandas: [],
    closedComandas: [],
    creditOrders: [
      {
        comanda: {
          closedAt: finalPaymentAt,
          events: [],
          id: "credit",
          name: "Maria",
          number: 14,
          status: "CLOSED",
          tableNumber: null,
        },
        customerName: "Maria",
        finalizedAt: new Date("2026-07-31T15:00:00.000Z"),
        payments: [
          {
            allocations: [
              { amountCents: 100, method: "CASH" },
              { amountCents: 200, method: "PIX" },
            ],
            amountCents: 300,
            id: "partial-payment",
            paidAt: new Date("2026-08-01T14:00:00.000Z"),
          },
          {
            allocations: [
              { amountCents: 400, method: "DEBIT_CARD" },
              { amountCents: 500, method: "CREDIT_CARD" },
            ],
            amountCents: 1_000,
            id: "final-payment",
            paidAt: finalPaymentAt,
          },
        ],
        source: "MANUAL",
      },
    ],
  });

  assert.deepEqual(
    report.entries.map(({ event, payments, receivedCents }) => ({
      event,
      payments,
      receivedCents,
    })),
    [
      {
        event: "CREDIT_PAYMENT",
        payments: [
          { amountCents: 100, method: "CASH" },
          { amountCents: 200, method: "PIX" },
        ],
        receivedCents: 300,
      },
      {
        event: "CREDIT_SETTLED",
        payments: [
          { amountCents: 400, method: "DEBIT_CARD" },
          { amountCents: 500, method: "CREDIT_CARD" },
        ],
        receivedCents: 1_000,
      },
    ],
  );
  assert.deepEqual(report.indicators.paymentMethodSummaries, [
    { method: "CASH", receivedCents: 100 },
    { method: "PIX", receivedCents: 200 },
    { method: "DEBIT_CARD", receivedCents: 400 },
    { method: "CREDIT_CARD", receivedCents: 500 },
    { method: "UNSPECIFIED", receivedCents: 100 },
  ]);
  assert.equal(
    report.indicators.paymentMethodSummaries.reduce(
      (total, method) => total + method.receivedCents,
      0,
    ),
    report.summary.receivedCents,
  );
});

void test("credit timelines calculate balances from history before the period", () => {
  const period = parseStatementPeriod("2026-08-02", "2026-08-02");
  const finalPaymentAt = new Date("2026-08-02T15:00:00.000Z");
  const report = buildStatementReport(period, {
    cancelledComandas: [],
    closedComandas: [],
    creditOrders: [
      {
        comanda: {
          closedAt: finalPaymentAt,
          events: [
            {
              createdAt: new Date("2026-07-31T12:00:00.000Z"),
              newQuantity: 1,
              previousQuantity: 0,
              productId: "coffee",
              productName: "Café",
              unitPriceCents: 1_000,
            },
            {
              createdAt: new Date("2026-08-02T13:00:00.000Z"),
              newQuantity: 2,
              previousQuantity: 1,
              productId: "coffee",
              productName: "Café",
              unitPriceCents: 1_000,
            },
          ],
          id: "credit-with-history",
          name: "Maria",
          number: 15,
          status: "CLOSED",
          tableNumber: null,
        },
        customerName: "Maria",
        finalizedAt: new Date("2026-07-31T13:00:00.000Z"),
        payments: [
          {
            allocations: [{ amountCents: 400, method: "PIX" }],
            amountCents: 400,
            id: "payment-before-period",
            paidAt: new Date("2026-07-31T14:00:00.000Z"),
          },
          {
            allocations: [{ amountCents: 300, method: "CASH" }],
            amountCents: 300,
            id: "payment-same-time",
            paidAt: new Date("2026-08-02T13:00:00.000Z"),
          },
          {
            allocations: [{ amountCents: 1_300, method: "DEBIT_CARD" }],
            amountCents: 1_300,
            id: "final-payment",
            paidAt: finalPaymentAt,
          },
        ],
        source: "MANUAL",
      },
    ],
  });

  assert.deepEqual(
    report.entries.map((entry) => ({
      balance: entry.creditBalanceAfterCents,
      event: entry.event,
    })),
    [
      { balance: 1_600, event: "CREDIT_ADDITION" },
      { balance: 1_300, event: "CREDIT_PAYMENT" },
      { balance: 0, event: "CREDIT_SETTLED" },
    ],
  );
});

void test("statement entry filters combine movement type and origin", () => {
  const period = parseStatementPeriod("2026-08-03", "2026-08-03");
  const report = buildStatementReport(period, {
    cancelledComandas: [
      {
        cancelledAt: new Date("2026-08-03T16:00:00.000Z"),
        creditOrder: null,
        id: "cancelled",
        items: [],
        name: null,
        number: 3,
        status: "CANCELLED",
        tableNumber: 3,
      },
    ],
    closedComandas: [
      {
        closedAt: new Date("2026-08-03T12:00:00.000Z"),
        creditOrder: null,
        id: "table",
        items: [
          {
            confirmedQuantity: 1,
            productId: "lunch",
            productName: "Almoço",
            quantity: 1,
            unitPriceCents: 2_000,
          },
        ],
        name: null,
        number: 1,
        status: "CLOSED",
        tableNumber: 1,
      },
    ],
    creditOrders: [
      {
        comanda: {
          events: [
            {
              createdAt: new Date("2026-08-03T13:00:00.000Z"),
              newQuantity: 1,
              previousQuantity: 0,
              productId: "coffee",
              productName: "Café",
              unitPriceCents: 1_000,
            },
          ],
          id: "credit",
          name: "Maria",
          number: 2,
          status: "OPEN",
          tableNumber: null,
        },
        customerName: "Maria",
        finalizedAt: new Date("2026-08-03T14:00:00.000Z"),
        payments: [
          {
            allocations: [{ amountCents: 300, method: "PIX" }],
            amountCents: 300,
            id: "credit-payment",
            paidAt: new Date("2026-08-03T15:00:00.000Z"),
          },
        ],
        source: "MANUAL",
      },
    ],
  });

  assert.deepEqual(
    filterStatementEntries(report.entries, {
      movementType: "SALES",
      origin: "ALL",
    }).map((entry) => entry.event),
    ["TABLE_CLOSED", "CREDIT_FINALIZED"],
  );
  assert.deepEqual(
    filterStatementEntries(report.entries, {
      movementType: "RECEIPTS",
      origin: "CREDIT_MANUAL",
    }).map((entry) => entry.event),
    ["CREDIT_PAYMENT"],
  );
  assert.deepEqual(
    filterStatementEntries(report.entries, {
      movementType: "CANCELLATIONS",
      origin: "ALL",
    }).map((entry) => entry.event),
    ["COMANDA_CANCELLED"],
  );
});

void test("table credit timelines separate checkout payment from later settlement", () => {
  const period = parseStatementPeriod("2026-08-03", "2026-08-03");
  const checkoutAt = new Date("2026-08-04T00:24:00.000Z");
  const settlementAt = new Date("2026-08-04T00:40:00.000Z");
  const report = buildStatementReport(period, {
    cancelledComandas: [],
    closedComandas: [],
    creditOrders: [
      {
        comanda: {
          closedAt: settlementAt,
          events: [
            {
              createdAt: checkoutAt,
              newQuantity: 1,
              previousQuantity: 0,
              productId: "order-product",
              productName: "Pedido",
              unitPriceCents: 12_300,
            },
          ],
          id: "partial-table-order",
          name: "Gustavo",
          number: 218,
          status: "CLOSED",
          tableNumber: 1,
        },
        customerName: "Gustavo",
        finalizedAt: checkoutAt,
        payments: [
          {
            allocations: [{ amountCents: 3_000, method: "PIX" }],
            amountCents: 3_000,
            id: "checkout-payment",
            origin: "TABLE_CHECKOUT",
            paidAt: checkoutAt,
          },
          {
            allocations: [{ amountCents: 9_300, method: "CASH" }],
            amountCents: 9_300,
            id: "credit-settlement",
            origin: "CREDIT_INSTALLMENT",
            paidAt: settlementAt,
          },
        ],
        source: "TABLE",
      },
    ],
  });

  assert.deepEqual(
    report.entries.map((entry) => ({
      balance: entry.creditBalanceAfterCents,
      event: entry.event,
      paidAfter: entry.creditPaidAfterCents,
      paidBefore: entry.creditPaidBeforeCents,
      paymentOrigin: entry.paymentOrigin,
      tableCheckoutPaid: entry.tableCheckoutPaidCents,
      total: entry.creditTotalCents,
    })),
    [
      {
        balance: 9_300,
        event: "CREDIT_FINALIZED",
        paidAfter: 3_000,
        paidBefore: 0,
        paymentOrigin: null,
        tableCheckoutPaid: 3_000,
        total: 12_300,
      },
      {
        balance: 9_300,
        event: "CREDIT_PAYMENT",
        paidAfter: 3_000,
        paidBefore: 0,
        paymentOrigin: "TABLE_CHECKOUT",
        tableCheckoutPaid: 3_000,
        total: 12_300,
      },
      {
        balance: 0,
        event: "CREDIT_SETTLED",
        paidAfter: 12_300,
        paidBefore: 3_000,
        paymentOrigin: "CREDIT_INSTALLMENT",
        tableCheckoutPaid: 3_000,
        total: 12_300,
      },
    ],
  );
});
