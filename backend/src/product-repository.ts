import type { PrismaClient } from "./generated/prisma/client.js";
import type { ProductCategory } from "./product-catalog.js";

export interface Product {
  category: ProductCategory;
  id: string;
  name: string;
  priceCents: number;
}

export interface ProductRepository {
  listActive(): Promise<Product[]>;
}

export function createProductRepository(prisma: PrismaClient): ProductRepository {
  return {
    async listActive() {
      return prisma.product.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          category: true,
          id: true,
          name: true,
          priceCents: true,
        },
        where: {
          active: true,
        },
      });
    },
  };
}
