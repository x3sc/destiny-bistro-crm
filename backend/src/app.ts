import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { AuthRepository } from "./auth-repository.js";
import { registerAuthentication } from "./authentication.js";
import type { ComandaRepository } from "./comanda-repository.js";
import type { CreditRepository } from "./credit-repository.js";
import type { Database } from "./database.js";
import type { DeliveryRepository } from "./delivery-repository.js";
import type { InventoryRepository } from "./inventory-repository.js";
import type { ProductRepository } from "./product-repository.js";
import type { RestaurantTableRepository } from "./restaurant-table-repository.js";
import type { StatementRepository } from "./statement-repository.js";
import { registerComandaRoutes } from "./routes/comanda-routes.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCreditRoutes } from "./routes/credit-routes.js";
import { registerDeliveryRoutes } from "./routes/delivery-routes.js";
import { registerInventoryRoutes } from "./routes/inventory-routes.js";
import { registerProductRoutes } from "./routes/product-routes.js";
import { registerRestaurantTableRoutes } from "./routes/restaurant-table-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerStatementRoutes } from "./routes/statement-routes.js";

interface BuildAppOptions {
  auth: AuthRepository;
  comandas: ComandaRepository;
  credits: CreditRepository;
  corsOrigins?: string[] | true;
  database: Database;
  deliveries: DeliveryRepository;
  inventory: InventoryRepository;
  logger?: FastifyServerOptions["logger"];
  products: ProductRepository;
  restaurantTables: RestaurantTableRepository;
  statements: StatementRepository;
}

export async function buildApp({
  auth,
  comandas,
  credits,
  corsOrigins = true,
  database,
  deliveries,
  inventory,
  logger = false,
  products,
  restaurantTables,
  statements,
}: BuildAppOptions) {
  const app = Fastify({ logger });

  await app.register(cors, {
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: corsOrigins,
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  registerAuthentication(app, auth);
  registerAuthRoutes(app, auth);
  registerSystemRoutes(app, database);
  registerProductRoutes(app, products);
  registerRestaurantTableRoutes(app, restaurantTables, comandas);
  registerComandaRoutes(app, comandas);
  registerCreditRoutes(app, credits);
  registerDeliveryRoutes(app, deliveries);
  registerInventoryRoutes(app, inventory);
  registerStatementRoutes(app, statements);

  app.addHook("onClose", async () => {
    await database.close();
  });

  return app;
}
