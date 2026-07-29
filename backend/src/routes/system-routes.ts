import type { FastifyInstance } from "fastify";
import type { Database } from "../database.js";

export function registerSystemRoutes(app: FastifyInstance, database: Database) {
  app.get(
    "/health",
    { config: { authPublic: true } },
    () => ({
      status: "ok",
      service: "api",
    }),
  );

  app.get("/ready", { config: { authPublic: true } }, async (_request, reply) => {
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
}
