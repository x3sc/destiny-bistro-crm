import "dotenv/config";
import { buildApp } from "./app.js";
import { createPersistence } from "./database.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3333);
const { comandas, credits, database, products, restaurantTables, statements } =
  createPersistence();
const app = await buildApp({
  comandas,
  credits,
  database,
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
