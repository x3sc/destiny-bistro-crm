import type { UserRepository } from "./user-types.js";
import type { RoleRepository } from './role-repository.js';
import { registerRoleRoutes } from './routes/role-routes.js';
import { registerUserRoutes } from "./routes/user-routes.js";
import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { AuthRepository } from "./auth-repository.js";
import { registerAuthentication } from "./authentication.js";
import { assertComandaSource } from './comanda-source-access.js';
import { RoleAccessError } from './role-policy.js';
import { ComandaNotFoundError } from './comanda-types.js';
import type { ComandaRepository } from "./comanda-repository.js";
import type { CreditRepository } from "./credit-repository.js";
import type { Database } from "./database.js";
import type { DeliveryRepository } from "./delivery-repository.js";
import {
  createDashboardRepository,
  type DashboardRepository,
} from "./dashboard-repository.js";
import type { InventoryRepository } from "./inventory-repository.js";
import type { KitchenRepository } from "./kitchen-types.js";
import type { ProductRepository } from "./product-repository.js";
import type { RestaurantTableRepository } from "./restaurant-table-repository.js";
import type { StatementRepository } from "./statement-repository.js";
import { registerComandaRoutes } from "./routes/comanda-routes.js";
import { registerCounterSalesRoutes } from './routes/counter-sales-routes.js';
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCreditRoutes } from "./routes/credit-routes.js";
import { registerDeliveryRoutes } from "./routes/delivery-routes.js";
import { registerDashboardRoutes } from "./routes/dashboard-routes.js";
import { registerInventoryRoutes } from "./routes/inventory-routes.js";
import { registerKitchenRoutes } from "./routes/kitchen-routes.js";
import { registerProductRoutes } from "./routes/product-routes.js";
import { registerRestaurantTableRoutes } from "./routes/restaurant-table-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerStatementRoutes } from "./routes/statement-routes.js";

interface BuildAppOptions {
  roles?: RoleRepository;
  users: UserRepository;
  auth: AuthRepository;
  comandas: ComandaRepository;
  credits: CreditRepository;
  dashboard?: DashboardRepository;
  corsOrigins?: string[] | true;
  database: Database;
  deliveries: DeliveryRepository;
  inventory: InventoryRepository;
  kitchen: KitchenRepository;
  logger?: FastifyServerOptions["logger"];
  products: ProductRepository;
  restaurantTables: RestaurantTableRepository;
  statements: StatementRepository;
}

export async function buildApp({
  roles,
  users,
  auth,
  comandas,
  credits,
  dashboard,
  corsOrigins = true,
  database,
  deliveries,
  inventory,
  kitchen,
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
  app.addHook('preHandler', async (request, reply) => {
    if (!request.routeOptions.url?.startsWith('/comandas/') || !request.authUser) return;
    const id = (request.params as { comandaId?: string }).comandaId;
    if (!id) return;
    try {
      const comanda = await comandas.findById(request.authUser.establishment.id, id);
      assertComandaSource(comanda, request.method === 'GET' ? 'read' : 'write');
    } catch (error) {
      if (error instanceof RoleAccessError) return reply.code(403).send({ message: 'Permission denied' });
      if (error instanceof ComandaNotFoundError) return request.method === 'GET' ? reply.code(404).send({ status: 'error', message: 'Comanda not found' }) : undefined;
      return reply.code(503).send({ message: 'Comanda unavailable' });
    }
  });
  registerAuthRoutes(app, auth);
  registerUserRoutes(app, users);
  registerRoleRoutes(app, roles);
  registerSystemRoutes(app, database);
  registerProductRoutes(app, products);
  registerRestaurantTableRoutes(app, restaurantTables, comandas);
  registerComandaRoutes(app, comandas);
  registerCounterSalesRoutes(app, comandas.counterSales);
  registerCreditRoutes(app, credits);
  registerDashboardRoutes(
    app,
    dashboard ??
      createDashboardRepository(restaurantTables, kitchen, statements),
  );
  registerDeliveryRoutes(app, deliveries);
  registerInventoryRoutes(app, inventory);
  registerKitchenRoutes(app, kitchen);
  registerStatementRoutes(app, statements);

  app.addHook("onClose", async () => {
    await database.close();
  });

  return app;
}
