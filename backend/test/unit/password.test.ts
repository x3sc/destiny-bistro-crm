import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeUserName,
  validatePassword,
} from "../../src/auth-repository.js";
import { AuthInputError } from "../../src/auth-types.js";
import { hashPassword, verifyPassword } from "../../src/password.js";

void test("passwords are salted, derived and verified without plaintext storage", async () => {
  const first = await hashPassword("correct-password");
  const second = await hashPassword("correct-password");

  assert.notEqual(first, second);
  assert.doesNotMatch(first, /correct-password/u);
  assert.equal(await verifyPassword("correct-password", first), true);
  assert.equal(await verifyPassword("incorrect-password", first), false);
  assert.equal(await verifyPassword("incorrect-password"), false);
});

void test("user names normalize spaces and case while preserving accents", () => {
  assert.deepEqual(normalizeUserName("  José   da Silva  "), {
    name: "José da Silva",
    normalizedName: "josé da silva",
  });
});

void test("password validation enforces the administrative provisioning policy", () => {
  assert.throws(() => validatePassword("short"), AuthInputError);
  assert.doesNotThrow(() => validatePassword("eight-ok"));
});
