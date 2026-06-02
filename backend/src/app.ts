import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Database } from "./database.js";

interface BuildAppOptions {
  database: Database;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp({ database, logger = false }: BuildAppOptions) {
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

  app.addHook("onClose", async () => {
    await database.close();
  });

  return app;
}
