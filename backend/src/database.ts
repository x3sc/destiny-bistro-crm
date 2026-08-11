import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.js";
import {
  createAuthRepository,
  type AuthRepository,
} from "./auth-repository.js";
import {
  createComandaRepository,
  type ComandaRepository,
} from "./comanda-repository.js";
import {
  createCreditRepository,
  type CreditRepository,
} from "./credit-repository.js";
import {
  createDeliveryRepository,
  type DeliveryRepository,
} from "./delivery-repository.js";
import {
  createProductRepository,
  type ProductRepository,
} from "./product-repository.js";
import {
  createInventoryRepository,
  type InventoryRepository,
} from "./inventory-repository.js";
import {
  createRestaurantTableRepository,
  type RestaurantTableRepository,
} from "./restaurant-table-repository.js";
import {
  createStatementRepository,
  type StatementRepository,
} from "./statement-repository.js";

export interface Database {
  close(): Promise<void>;
  ping(): Promise<void>;
}

export interface Persistence {
  auth: AuthRepository;
  comandas: ComandaRepository;
  credits: CreditRepository;
  database: Database;
  deliveries: DeliveryRepository;
  inventory: InventoryRepository;
  products: ProductRepository;
  restaurantTables: RestaurantTableRepository;
  statements: StatementRepository;
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
    auth: createAuthRepository(prisma),
    comandas: createComandaRepository(prisma),
    credits: createCreditRepository(prisma),
    database: {
      async close() {
        await prisma.$disconnect();
      },
      async ping() {
        await prisma.$queryRaw`SELECT 1`;
      },
    },
    deliveries: createDeliveryRepository(prisma),
    inventory: createInventoryRepository(prisma),
    products: createProductRepository(prisma),
    restaurantTables: createRestaurantTableRepository(prisma),
    statements: createStatementRepository(prisma),
  };
}
