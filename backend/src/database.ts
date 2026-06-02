import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.js";

export interface Database {
  close(): Promise<void>;
  ping(): Promise<void>;
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createDatabase(): Database {
  const adapter = new PrismaMariaDb({
    host: requiredEnvironmentVariable("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnvironmentVariable("DATABASE_USER"),
    password: requiredEnvironmentVariable("DATABASE_PASSWORD"),
    database: requiredEnvironmentVariable("DATABASE_NAME"),
    connectionLimit: 5,
  });
  const prisma = new PrismaClient({ adapter });

  return {
    async close() {
      await prisma.$disconnect();
    },
    async ping() {
      await prisma.$queryRaw`SELECT 1`;
    },
  };
}
