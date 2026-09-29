import assert from "node:assert/strict";
import { test } from "node:test";
import { comandaOpenedDate } from "../../src/comanda-numbering.js";

void test("comanda opening date follows the Sao Paulo calendar boundary", () => {
  assert.equal(
    comandaOpenedDate(new Date("2026-09-28T02:59:59.999Z")),
    "2026-09-27",
  );
  assert.equal(
    comandaOpenedDate(new Date("2026-09-28T03:00:00.000Z")),
    "2026-09-28",
  );
});
