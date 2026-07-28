import { createPrismaClient } from "../src/database.js";
import {
  LEGACY_SEED_PRODUCT_CODES,
  PORTUGAS_MENU,
} from "../src/product-catalog.js";

const prisma = createPrismaClient();

async function seedRestaurantTables() {
  await Promise.all(
    Array.from({ length: 12 }, (_, index) => {
      const number = index + 1;

      return prisma.restaurantTable.upsert({
        where: { number },
        update: {},
        create: {
          number,
          status: "FREE",
        },
      });
    }),
  );
}

async function seedProducts() {
  await prisma.$transaction(
    [
      prisma.product.updateMany({
        data: {
          active: false,
        },
        where: {
          code: {
            in: [...LEGACY_SEED_PRODUCT_CODES],
          },
        },
      }),
      ...PORTUGAS_MENU.map((product) =>
        prisma.product.upsert({
          where: { code: product.code },
          update: {
            active: product.active,
            category: product.category,
            name: product.name,
            priceCents: product.priceCents,
          },
          create: {
            active: product.active,
            category: product.category,
            code: product.code,
            name: product.name,
            priceCents: product.priceCents,
          },
        }),
      ),
    ],
    {
      timeout: 30_000,
    },
  );
}

try {
  await seedRestaurantTables();
  await seedProducts();
} finally {
  await prisma.$disconnect();
}
