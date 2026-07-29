import type { Prisma } from "./generated/prisma/client.js";
import {
  LEGACY_SEED_PRODUCT_CODES,
  PORTUGAS_MENU,
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

  for (const product of PORTUGAS_MENU) {
    await transaction.product.upsert({
      create: {
        active: product.active,
        category: product.category,
        code: product.code,
        establishmentId,
        name: product.name,
        priceCents: product.priceCents,
      },
      update: {
        active: product.active,
        category: product.category,
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
