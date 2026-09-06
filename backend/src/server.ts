import "dotenv/config";
import { buildApp } from "./app.js";
import { createPersistence } from "./database.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3333);
const corsOrigins = parseCorsOrigins();
const {
  auth,
  comandas,
  credits,
  database,
  deliveries,
  inventory,
  kitchen,
  products,
  restaurantTables,
  statements,
} = createPersistence();
const app = await buildApp({
  auth,
  comandas,
  credits,
  corsOrigins,
  database,
  deliveries,
  inventory,
  kitchen,
  logger: true,
  products,
  restaurantTables,
  statements,
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}

function parseCorsOrigins() {
  const value = process.env.CORS_ORIGINS;

  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required environment variable: CORS_ORIGINS");
    }

    return true;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
