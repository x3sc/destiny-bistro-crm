import assert from "node:assert/strict";
import { test } from "node:test";
import { PORTUGAS_MENU } from "../../src/product-catalog.js";

void test("Portugal's menu contains the referenced catalog with prices in cents", () => {
  const productsByCode = new Map<string, (typeof PORTUGAS_MENU)[number]>(
    PORTUGAS_MENU.map((product) => [product.code, product]),
  );

  assert.equal(PORTUGAS_MENU.length, 60);
  assert.equal(productsByCode.size, PORTUGAS_MENU.length);

  assert.deepEqual(productsByCode.get("CLASSIC_HAMBURGER"), {
    active: true,
    category: "CLASSIC_BURGERS",
    code: "CLASSIC_HAMBURGER",
    name: "Hambúrguer",
    priceCents: 1_099,
  });
  assert.equal(productsByCode.get("ARTISAN_HOT_LOVE")?.priceCents, 2_199);
  assert.equal(productsByCode.get("EXTRA_EGG")?.priceCents, 200);
  assert.equal(productsByCode.get("DRINK_MINERAL_WATER")?.priceCents, 300);
  assert.equal(productsByCode.get("COCKTAIL_CAIPIRINHA_LIME")?.priceCents, 1_000);
  assert.equal(productsByCode.get("BEER_IMPERIO_473ML")?.priceCents, 800);
  assert.equal(productsByCode.get("SIDE_FRIES_SMALL")?.priceCents, 799);
  assert.equal(productsByCode.get("SNACK_CALABRESA_FRIES")?.priceCents, 2_999);
  assert.equal(productsByCode.get("COMBO_FAMILY")?.priceCents, 6_999);

  for (const product of PORTUGAS_MENU) {
    assert.notEqual(product.category, "OTHER");
    assert.ok(Number.isInteger(product.priceCents));
    assert.ok(product.priceCents > 0);
  }

  assert.equal(PORTUGAS_MENU.filter(({ active }) => active).length, 55);
  assert.equal(
    PORTUGAS_MENU.filter(({ active }) => !active).every(
      ({ category }) => category === "EXTRAS",
    ),
    true,
  );

  const categoryCounts: Record<string, number> = {};

  for (const { category } of PORTUGAS_MENU) {
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  }

  assert.deepEqual(categoryCounts, {
    ARTISAN_BURGERS: 4,
    BEERS: 4,
    BEVERAGES: 10,
    CLASSIC_BURGERS: 9,
    COCKTAILS: 3,
    COMBOS: 6,
    EXTRAS: 5,
    SIDES: 10,
    SNACKS: 9,
  });

  assert.equal(productsByCode.has("COFFEE"), false);
  assert.equal(productsByCode.has("DAILY_SPECIAL"), false);
});
