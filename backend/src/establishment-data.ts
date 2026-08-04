import type { Prisma } from "./generated/prisma/client.js";
import {
  DEFAULT_MENU_CATEGORY_NAMES,
  LEGACY_SEED_PRODUCT_CODES,
  PORTUGAS_MENU,
  PRODUCT_CATEGORIES,
} from "./product-catalog.js";

export async function seedEstablishmentData(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
) {
  await Promise.all(
    Array.from({ length: 12 }, (_, index) => {
      const number = index + 1;

      return transaction.restaurantTable.upsert({
        create: {
          establishmentId,
          number,
          status: "FREE",
        },
        update: {},
        where: {
          establishmentId_number: {
            establishmentId,
            number,
          },
        },
      });
    }),
  );

  await transaction.product.updateMany({
    data: {
      active: false,
    },
    where: {
      code: {
        in: [...LEGACY_SEED_PRODUCT_CODES],
      },
      establishmentId,
    },
  });

  const categoryIds = new Map<string, string>();
  for (const categoryCode of PRODUCT_CATEGORIES) {
    const name = DEFAULT_MENU_CATEGORY_NAMES[categoryCode];
    const normalizedName = name.toLocaleLowerCase("pt-BR");
    const category = await transaction.menuCategory.upsert({
      create: {
        establishmentId,
        name,
        normalizedName,
      },
      update: { name },
      where: {
        establishmentId_normalizedName: {
          establishmentId,
          normalizedName,
        },
      },
    });
    categoryIds.set(categoryCode, category.id);
  }

  for (const product of PORTUGAS_MENU) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) {
      throw new Error(`Missing menu category: ${product.category}`);
    }

    await transaction.product.upsert({
      create: {
        active: product.active,
        categoryId,
        code: product.code,
        establishmentId,
        name: product.name,
        priceCents: product.priceCents,
      },
      update: {
        active: product.active,
        categoryId,
        name: product.name,
        priceCents: product.priceCents,
      },
      where: {
        establishmentId_code: {
          code: product.code,
          establishmentId,
        },
      },
    });
  }
}
