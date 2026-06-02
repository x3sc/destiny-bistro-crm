import "dotenv/config";
import { buildApp } from "./app.js";
import { createDatabase } from "./database.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3333);
const database = createDatabase();
const app = await buildApp({ database, logger: true });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
