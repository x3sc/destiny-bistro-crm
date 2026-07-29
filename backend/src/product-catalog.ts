export const PRODUCT_CATEGORIES = [
  "CLASSIC_BURGERS",
  "ARTISAN_BURGERS",
  "EXTRAS",
  "BEVERAGES",
  "COCKTAILS",
  "BEERS",
  "SIDES",
  "SNACKS",
  "COMBOS",
  "OTHER",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

const menuItems = [
  { code: "CLASSIC_HAMBURGER", name: "Hambúrguer", priceCents: 1_099 },
  { code: "CLASSIC_CHESSBURGER", name: "Chessburguer", priceCents: 1_200 },
  { code: "CLASSIC_EGG_BURGER", name: "Egg-Búrguer", priceCents: 1_400 },
  { code: "CLASSIC_BACON_BURGER", name: "Bacon-Burguer", priceCents: 1_499 },
  {
    code: "CLASSIC_CHESS_EGG_BURGER",
    name: "Chess Egg-Búrguer",
    priceCents: 1_599,
  },
  { code: "CLASSIC_CHESS_TUDO", name: "Chess-Tudo", priceCents: 1_799 },
  { code: "CLASSIC_DOUBLE_BURGER", name: "Duplo Burguer", priceCents: 2_099 },
  { code: "CLASSIC_TRIPLE_BURGER", name: "Triplo Burguer", priceCents: 2_499 },
  { code: "CLASSIC_PORTUGA", name: "Portuga", priceCents: 2_799 },

  { code: "ARTISAN_HOT_LOVE", name: "Hot Love", priceCents: 2_199 },
  { code: "ARTISAN_BABY_BACON", name: "Baby Bacon", priceCents: 2_299 },
  { code: "ARTISAN_RAIZ_BURGER", name: "Raiz-Burguer", priceCents: 2_399 },
  { code: "ARTISAN_DOUBLE_BACON", name: "Double Bacon", priceCents: 3_399 },

  { code: "EXTRA_EGG", name: "Adicional de ovo", priceCents: 200 },
  { code: "EXTRA_CHEESE", name: "Adicional de queijo", priceCents: 200 },
  { code: "EXTRA_BACON", name: "Adicional de bacon", priceCents: 300 },
  { code: "EXTRA_BLEND", name: "Adicional de blend", priceCents: 600 },
  { code: "EXTRA_BURGER", name: "Adicional de hambúrguer", priceCents: 300 },

  { code: "DRINK_MINERAL_WATER", name: "Água mineral", priceCents: 300 },
  {
    code: "DRINK_SPARKLING_WATER",
    name: "Água mineral com gás",
    priceCents: 400,
  },
  { code: "DRINK_COCONUT_WATER", name: "Água de coco", priceCents: 1_000 },
  { code: "DRINK_GUARACAMP", name: "Guaracamp", priceCents: 300 },
  { code: "DRINK_COKE_200ML", name: "Coquinha 200 ml", priceCents: 400 },
  { code: "DRINK_COKE_CAN", name: "Coca-Cola lata", priceCents: 700 },
  { code: "DRINK_ANTARCTICA_CAN", name: "Antártica lata", priceCents: 700 },
  {
    code: "DRINK_GUARANA_ANTARCTICA_1L",
    name: "Guaraná Antarctica 1 L",
    priceCents: 800,
  },
  { code: "DRINK_GUARANA_IT_2L", name: "Guaraná It! 2 L", priceCents: 900 },
  { code: "DRINK_COKE_2L", name: "Coca-Cola 2 L", priceCents: 1_600 },

  {
    code: "COCKTAIL_CAIPIRINHA_LIME",
    name: "Caipirinha de limão",
    priceCents: 1_000,
  },
  {
    code: "COCKTAIL_CAIPIRINHA_PASSION_FRUIT",
    name: "Caipirinha de maracujá",
    priceCents: 1_000,
  },
  { code: "COCKTAIL_CAIPIVODKA", name: "Caipivodka", priceCents: 1_500 },

  { code: "BEER_IMPERIO_473ML", name: "Império 473 ml", priceCents: 800 },
  { code: "BEER_ANTARCTICA_473ML", name: "Antártica 473 ml", priceCents: 900 },
  { code: "BEER_BRAHMA_473ML", name: "Brahma 473 ml", priceCents: 900 },
  { code: "BEER_HEINEKEN_473ML", name: "Heineken 473 ml", priceCents: 1_200 },

  { code: "SIDE_FRIES_SMALL", name: "Batata frita pequena", priceCents: 799 },
  { code: "SIDE_FRIES_MEDIUM", name: "Batata frita média", priceCents: 1_299 },
  { code: "SIDE_FRIES_LARGE", name: "Batata frita grande", priceCents: 1_999 },
  { code: "SIDE_NUGGETS_4", name: "Nuggets (4 unidades)", priceCents: 699 },
  { code: "SIDE_NUGGETS_6", name: "Nuggets (6 unidades)", priceCents: 950 },
  { code: "SIDE_NUGGETS_10", name: "Nuggets (10 unidades)", priceCents: 1_499 },
  {
    code: "SIDE_CHEDDAR_FRIES_MEDIUM",
    name: "Batata ao banho de cheddar média",
    priceCents: 1_599,
  },
  {
    code: "SIDE_CHEDDAR_FRIES_LARGE",
    name: "Batata ao banho de cheddar grande",
    priceCents: 2_699,
  },
  {
    code: "SIDE_LOADED_FRIES_MEDIUM",
    name: "Batata maluca média",
    priceCents: 1_999,
  },
  {
    code: "SIDE_LOADED_FRIES_LARGE",
    name: "Batata maluca grande",
    priceCents: 2_999,
  },

  {
    code: "SNACK_CALABRESA_FRIES",
    name: "Calabresa acebolada com batata frita",
    priceCents: 2_999,
  },
  {
    code: "SNACK_POTATO_DICE_CHEESE",
    name: "Dadinho de batata com queijo",
    priceCents: 2_399,
  },
  {
    code: "SNACK_POTATO_DICE_BACON",
    name: "Dadinho de batata com bacon",
    priceCents: 2_399,
  },
  {
    code: "SNACK_COD_CAKES_10",
    name: "Bolinho de bacalhau (10 unidades)",
    priceCents: 2_499,
  },
  {
    code: "SNACK_SHRIMP_CAKES_6",
    name: "Bolinho de camarão (6 unidades)",
    priceCents: 2_399,
  },
  {
    code: "SNACK_FEIJOADA_CAKES_5",
    name: "Bolinho de feijoada (5 unidades)",
    priceCents: 2_299,
  },
  { code: "SNACK_ONION_RINGS_5", name: "Anel de cebola (5 unidades)", priceCents: 899 },
  {
    code: "SNACK_ONION_RINGS_8",
    name: "Anel de cebola (8 unidades)",
    priceCents: 1_199,
  },
  {
    code: "SNACK_ONION_RINGS_12",
    name: "Anel de cebola (12 unidades)",
    priceCents: 1_799,
  },

  { code: "COMBO_RAIZ", name: "Combo Raiz", priceCents: 1_999 },
  { code: "COMBO_COUPLE", name: "Combo Casal", priceCents: 4_999 },
  { code: "COMBO_BACONZADA", name: "Combo Baconzada", priceCents: 2_299 },
  { code: "COMBO_TRADITIONAL", name: "Combo Tradicional", priceCents: 2_198 },
  { code: "COMBO_XIS", name: "Combo Xis", priceCents: 2_598 },
  { code: "COMBO_FAMILY", name: "Combo Família", priceCents: 6_999 },
] as const;

function categoryForCode(code: string): ProductCategory {
  if (code.startsWith("CLASSIC_")) {
    return "CLASSIC_BURGERS";
  }

  if (code.startsWith("ARTISAN_")) {
    return "ARTISAN_BURGERS";
  }

  if (code.startsWith("EXTRA_")) {
    return "EXTRAS";
  }

  if (code.startsWith("DRINK_")) {
    return "BEVERAGES";
  }

  if (code.startsWith("COCKTAIL_")) {
    return "COCKTAILS";
  }

  if (code.startsWith("BEER_")) {
    return "BEERS";
  }

  if (code.startsWith("SIDE_")) {
    return "SIDES";
  }

  if (code.startsWith("SNACK_")) {
    return "SNACKS";
  }

  if (code.startsWith("COMBO_")) {
    return "COMBOS";
  }

  return "OTHER";
}

export const PORTUGAS_MENU = menuItems.map((product) => ({
  active: categoryForCode(product.code) !== "EXTRAS",
  category: categoryForCode(product.code),
  ...product,
}));

export const LEGACY_SEED_PRODUCT_CODES = [
  "COFFEE",
  "WATER",
  "SODA",
  "JUICE",
  "SANDWICH",
  "DAILY_SPECIAL",
] as const;
