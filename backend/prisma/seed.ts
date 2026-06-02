import { createPrismaClient } from "../src/database.js";

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

try {
  await seedRestaurantTables();
} finally {
  await prisma.$disconnect();
}
