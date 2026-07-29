import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  CreditCustomerNameError,
  CreditCustomerNotFoundError,
  CreditOrderConflictError,
  CreditOrderNotFoundError,
  CreditSettlementConflictError,
  type CreditRepository,
} from "../credit-repository.js";

interface CustomerParams {
  customerId: string;
}

interface OrderParams {
  orderId: string;
}

interface ComandaParams {
  comandaId: string;
}

interface CreateCustomerBody {
  name?: unknown;
}

interface ConvertComandaBody {
  customerId?: unknown;
}

interface CustomerListQuery {
  includeInactive?: string;
}

export function registerCreditRoutes(
  app: FastifyInstance,
  credits: CreditRepository,
) {
  app.get<{ Querystring: CustomerListQuery }>(
    "/credit-customers",
    { config: { permission: "credits.read" } },
    async (request, reply) => {
      try {
        return {
          customers: await credits.listCustomers(
            request.query.includeInactive === "true",
          ),
        };
      } catch (error) {
        app.log.error(error, "Credit customer query failed");

        return reply.code(503).send({
          status: "error",
          message: "Credit customers unavailable",
        });
      }
    },
  );

  app.post<{ Body: CreateCustomerBody }>(
    "/credit-customers",
    { config: { permission: "credits.write" } },
    async (request, reply) => {
      if (!request.body || typeof request.body.name !== "string") {
        return reply.code(409).send({
          status: "error",
          message: "Invalid customer name",
        });
      }

      try {
        return reply.code(201).send({
          customer: await credits.createCustomer(
            request.body.name,
            requireAuthUser(request).id,
          ),
        });
      } catch (error) {
        if (error instanceof CreditCustomerNameError) {
          return reply.code(409).send({
            status: "error",
            message: "Invalid customer name",
          });
        }

        app.log.error(error, "Credit customer creation failed");

        return reply.code(503).send({
          status: "error",
          message: "Credit customer unavailable",
        });
      }
    },
  );

  app.get<{ Params: CustomerParams }>(
    "/credit-customers/:customerId",
    { config: { permission: "credits.read" } },
    async (request, reply) => {
      try {
        return {
          customer: await credits.findCustomer(request.params.customerId),
        };
      } catch (error) {
        if (error instanceof CreditCustomerNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Credit customer not found",
          });
        }

        app.log.error(error, "Credit customer detail query failed");

        return reply.code(503).send({
          status: "error",
          message: "Credit customer unavailable",
        });
      }
    },
  );

  app.post<{ Params: CustomerParams }>(
    "/credit-customers/:customerId/orders",
    { config: { permission: "credits.write" } },
    async (request, reply) => {
      try {
        return reply.code(201).send({
          order: await credits.createOrder(
            request.params.customerId,
            requireAuthUser(request).id,
          ),
        });
      } catch (error) {
        if (error instanceof CreditCustomerNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Credit customer not found",
          });
        }

        app.log.error(error, "Credit order creation failed");

        return reply.code(503).send({
          status: "error",
          message: "Credit order unavailable",
        });
      }
    },
  );

  app.post<{ Params: OrderParams }>(
    "/credit-orders/:orderId/finalize",
    { config: { permission: "credits.write" } },
    async (request, reply) => {
      try {
        return {
          order: await credits.finalizeOrder(
            request.params.orderId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        return sendOrderError(app, reply, error, "Credit order finalization failed");
      }
    },
  );

  app.post<{ Params: OrderParams }>(
    "/credit-orders/:orderId/cancel",
    { config: { permission: "credits.write" } },
    async (request, reply) => {
      try {
        return {
          order: await credits.cancelOrder(
            request.params.orderId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        return sendOrderError(app, reply, error, "Credit order cancellation failed");
      }
    },
  );

  app.post<{ Params: OrderParams }>(
    "/credit-orders/:orderId/settle",
    { config: { permission: "credits.write" } },
    async (request, reply) => {
      try {
        return {
          settlement: await credits.settleOrder(
            request.params.orderId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (error instanceof CreditOrderNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Credit order not found",
          });
        }

        if (error instanceof CreditSettlementConflictError) {
          return reply.code(409).send({
            status: "error",
            message: "Credit balance cannot be settled",
          });
        }

        app.log.error(error, "Credit settlement failed");

        return reply.code(503).send({
          status: "error",
          message: "Credit settlement unavailable",
        });
      }
    },
  );

  app.post<{ Body: ConvertComandaBody; Params: ComandaParams }>(
    "/comandas/:comandaId/credit",
    { config: { permission: "credits.write" } },
    async (request, reply) => {
      if (
        !request.body ||
        typeof request.body.customerId !== "string" ||
        !request.body.customerId
      ) {
        return reply.code(409).send({
          status: "error",
          message: "Credit customer is required",
        });
      }

      try {
        return {
          order: await credits.convertComanda(
            request.params.comandaId,
            request.body.customerId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (
          error instanceof CreditCustomerNotFoundError ||
          error instanceof CreditOrderNotFoundError
        ) {
          return reply.code(404).send({
            status: "error",
            message: "Credit resource not found",
          });
        }

        if (error instanceof CreditOrderConflictError) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda cannot be converted to credit",
          });
        }

        app.log.error(error, "Comanda credit conversion failed");

        return reply.code(503).send({
          status: "error",
          message: "Credit order unavailable",
        });
      }
    },
  );
}

function sendOrderError(
  app: FastifyInstance,
  reply: {
    code(statusCode: number): {
      send(payload: { message: string; status: string }): unknown;
    };
  },
  error: unknown,
  logMessage: string,
) {
  if (error instanceof CreditOrderNotFoundError) {
    return reply.code(404).send({
      status: "error",
      message: "Credit order not found",
    });
  }

  if (error instanceof CreditOrderConflictError) {
    return reply.code(409).send({
      status: "error",
      message: "Credit order cannot be changed",
    });
  }

  app.log.error(error, logMessage);

  return reply.code(503).send({
    status: "error",
    message: "Credit order unavailable",
  });
}
