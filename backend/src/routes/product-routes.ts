import type { FastifyInstance } from "fastify";
import type { ProductRepository } from "../product-repository.js";

export function registerProductRoutes(app: FastifyInstance, products: ProductRepository) {
  app.get("/products", async (_request, reply) => {
    try {
      return {
        products: await products.listActive(),
      };
    } catch (error) {
      app.log.error(error, "Product query failed");

      return reply.code(503).send({
        status: "error",
        message: "Products unavailable",
      });
    }
  });
}
