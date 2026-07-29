import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStatementReport,
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
              unitPriceCents: 500,
            },
            {
              createdAt: new Date("2026-07-29T14:00:00.000Z"),
              newQuantity: 3,
              previousQuantity: 1,
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
});

void test("empty statement periods return zero totals and every selected day", () => {
  const period = parseStatementPeriod("2026-07-28", "2026-07-29");
  const report = buildStatementReport(period, {
    cancelledComandas: [],
    closedComandas: [],
    creditOrders: [],
  });

  assert.equal(report.summary.processedCommandCount, 0);
  assert.deepEqual(
    report.days.map((day) => day.date),
    ["2026-07-28", "2026-07-29"],
  );
  assert.deepEqual(report.entries, []);
});
