import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Database } from "./database.js";
import type { RestaurantTableRepository } from "./restaurant-table-repository.js";

interface BuildAppOptions {
  database: Database;
  logger?: FastifyServerOptions["logger"];
  restaurantTables: RestaurantTableRepository;
}

export async function buildApp({ database, logger = false, restaurantTables }: BuildAppOptions) {
  const app = Fastify({ logger });

  await app.register(cors);

  app.get("/health", () => ({
    status: "ok",
    service: "api",
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await database.ping();

      return {
        status: "ok",
        database: "connected",
      };
    } catch (error) {
      app.log.error(error, "Database readiness check failed");

      return reply.code(503).send({
        status: "error",
        database: "unavailable",
      });
    }
  });

  app.get("/tables", async (_request, reply) => {
    try {
      return {
        tables: await restaurantTables.list(),
      };
    } catch (error) {
      app.log.error(error, "Restaurant table query failed");

      return reply.code(503).send({
        status: "error",
        message: "Tables unavailable",
      });
    }
  });

  app.addHook("onClose", async () => {
    await database.close();
  });

  return app;
}
