import type { PrismaClient } from "./generated/prisma/client.js";

export type RestaurantTableStatus = "FREE" | "OPEN" | "AWAITING_CHECK";

export interface RestaurantTable {
  activeComanda: {
    id: string;
    name: string | null;
    number: number;
  } | null;
  id: number;
  number: number;
  status: RestaurantTableStatus;
}

export interface RestaurantTableRepository {
  list(): Promise<RestaurantTable[]>;
}

export function createRestaurantTableRepository(
  prisma: PrismaClient,
): RestaurantTableRepository {
  return {
    async list() {
      return prisma.restaurantTable.findMany({
        orderBy: {
          number: "asc",
        },
        select: {
          activeComanda: {
            select: {
              id: true,
              name: true,
              number: true,
            },
          },
          id: true,
          number: true,
          status: true,
        },
      });
    },
  };
}
