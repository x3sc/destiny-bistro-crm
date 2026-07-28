import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.js";
import {
  createComandaRepository,
  type ComandaRepository,
} from "./comanda-repository.js";
import {
  createProductRepository,
  type ProductRepository,
} from "./product-repository.js";
import {
  createRestaurantTableRepository,
  type RestaurantTableRepository,
} from "./restaurant-table-repository.js";

export interface Database {
  close(): Promise<void>;
  ping(): Promise<void>;
}

export interface Persistence {
  comandas: ComandaRepository;
  database: Database;
  products: ProductRepository;
  restaurantTables: RestaurantTableRepository;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createPrismaClient() {
  const adapter = new PrismaMariaDb({
    host: requiredEnvironmentVariable("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnvironmentVariable("DATABASE_USER"),
    password: requiredEnvironmentVariable("DATABASE_PASSWORD"),
    database: requiredEnvironmentVariable("DATABASE_NAME"),
    connectionLimit: 5,
  });

  return new PrismaClient({ adapter });
}

export function createPersistence(): Persistence {
  const prisma = createPrismaClient();

  return {
    comandas: createComandaRepository(prisma),
    database: {
      async close() {
        await prisma.$disconnect();
      },
      async ping() {
        await prisma.$queryRaw`SELECT 1`;
      },
    },
    products: createProductRepository(prisma),
    restaurantTables: createRestaurantTableRepository(prisma),
  };
}
