import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { ComandaRepository } from "./comanda-repository.js";
import type { CreditRepository } from "./credit-repository.js";
import type { Database } from "./database.js";
import type { ProductRepository } from "./product-repository.js";
import type { RestaurantTableRepository } from "./restaurant-table-repository.js";
import type { StatementRepository } from "./statement-repository.js";
import { registerComandaRoutes } from "./routes/comanda-routes.js";
import { registerCreditRoutes } from "./routes/credit-routes.js";
import { registerProductRoutes } from "./routes/product-routes.js";
import { registerRestaurantTableRoutes } from "./routes/restaurant-table-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerStatementRoutes } from "./routes/statement-routes.js";

interface BuildAppOptions {
  comandas: ComandaRepository;
  credits: CreditRepository;
  database: Database;
  logger?: FastifyServerOptions["logger"];
  products: ProductRepository;
  restaurantTables: RestaurantTableRepository;
  statements: StatementRepository;
}

export async function buildApp({
  comandas,
  credits,
  database,
  logger = false,
  products,
  restaurantTables,
  statements,
}: BuildAppOptions) {
  const app = Fastify({ logger });

  await app.register(cors, {
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin: true,
    allowedHeaders: ["Content-Type"],
  });

  registerSystemRoutes(app, database);
  registerProductRoutes(app, products);
  registerRestaurantTableRoutes(app, restaurantTables, comandas);
  registerComandaRoutes(app, comandas);
  registerCreditRoutes(app, credits);
  registerStatementRoutes(app, statements);

  app.addHook("onClose", async () => {
    await database.close();
  });

  return app;
}
