import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import type { ProductRepository } from "../product-repository.js";

export function registerProductRoutes(app: FastifyInstance, products: ProductRepository) {
  app.get(
    "/products",
    { config: { permission: "products.read" } },
    async (request, reply) => {
    try {
      return {
        products: await products.listActive(
          requireAuthUser(request).establishment.id,
        ),
      };
    } catch (error) {
      app.log.error(error, "Product query failed");

      return reply.code(503).send({
        status: "error",
        message: "Products unavailable",
      });
    }
    },
  );
}
