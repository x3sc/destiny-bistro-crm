import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionKitchenTicket,
  isKitchenTicketStatus,
  type KitchenTicketStatus,
} from "../../src/kitchen-types.js";

void test("kitchen status transitions follow the operational sequence", () => {
  const allowed: Array<[KitchenTicketStatus, KitchenTicketStatus]> = [
    ["PENDING", "PREPARING"],
    ["PREPARING", "READY"],
    ["READY", "DELIVERED"],
    ["PENDING", "CANCELLED"],
    ["PREPARING", "CANCELLED"],
    ["READY", "CANCELLED"],
    ["READY", "READY"],
  ];
  for (const [previous, next] of allowed) {
    assert.equal(canTransitionKitchenTicket(previous, next), true);
  }
});

void test("kitchen status transitions reject skips and terminal reversals", () => {
  const rejected: Array<[KitchenTicketStatus, KitchenTicketStatus]> = [
    ["PENDING", "READY"],
    ["PENDING", "DELIVERED"],
    ["PREPARING", "PENDING"],
    ["READY", "PREPARING"],
    ["DELIVERED", "PREPARING"],
    ["DELIVERED", "CANCELLED"],
    ["CANCELLED", "PENDING"],
  ];
  for (const [previous, next] of rejected) {
    assert.equal(canTransitionKitchenTicket(previous, next), false);
  }
});

void test("kitchen status parser accepts only the public enum", () => {
  assert.equal(isKitchenTicketStatus("PREPARING"), true);
  assert.equal(isKitchenTicketStatus("UNKNOWN"), false);
  assert.equal(isKitchenTicketStatus(undefined), false);
});
