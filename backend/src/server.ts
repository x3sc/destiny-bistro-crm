import "dotenv/config";
import { buildApp } from "./app.js";
import { createPersistence } from "./database.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3333);
const { comandas, database, products, restaurantTables } = createPersistence();
const app = await buildApp({ comandas, database, logger: true, products, restaurantTables });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
