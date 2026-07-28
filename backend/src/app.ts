import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { ComandaRepository } from "./comanda-repository.js";
import type { Database } from "./database.js";
import type { ProductRepository } from "./product-repository.js";
import type { RestaurantTableRepository } from "./restaurant-table-repository.js";
import { registerComandaRoutes } from "./routes/comanda-routes.js";
import { registerProductRoutes } from "./routes/product-routes.js";
import { registerRestaurantTableRoutes } from "./routes/restaurant-table-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";

interface BuildAppOptions {
  comandas: ComandaRepository;
  database: Database;
  logger?: FastifyServerOptions["logger"];
  products: ProductRepository;
  restaurantTables: RestaurantTableRepository;
}

export async function buildApp({
  comandas,
  database,
  logger = false,
  products,
  restaurantTables,
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

  app.addHook("onClose", async () => {
    await database.close();
  });

  return app;
}
