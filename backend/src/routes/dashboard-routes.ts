import type { FastifyInstance } from "fastify";
import { hasAppPermission, requireAuthUser } from "../authentication.js";
import type { DashboardRepository } from "../dashboard-repository.js";

export function registerDashboardRoutes(
  app: FastifyInstance,
  dashboard: DashboardRepository,
) {
  app.get("/dashboard/today", async (request, reply) => {
    const user = requireAuthUser(request);

    try {
      return {
        today: await dashboard.findToday(user.establishment.id, {
          kitchen: hasAppPermission(user, "kitchen.read"),
          sales: hasAppPermission(user, "statements.read"),
          tables: hasAppPermission(user, "tables.read"),
        }),
      };
    } catch (error) {
      app.log.error(error, "Dashboard today query failed");
      return reply.code(503).send({
        message: "Dashboard unavailable",
        status: "error",
      });
    }
  });
}
