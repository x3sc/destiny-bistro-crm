import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  DeliveryCourierConflictError,
  DeliveryCourierNameError,
  DeliveryCourierNotFoundError,
  DeliveryDayConflictError,
  DeliveryDayNotFoundError,
  DeliveryInputError,
  normalizeCents,
  normalizeDeliveryInput,
  normalizeExpenseInput,
  type DeliveryPeriod,
  type DeliveryRepository,
} from "../delivery-repository.js";
import {
  parseStatementPeriod,
  StatementPeriodError,
} from "../statement-report.js";

interface CourierParams {
  courierId: string;
}

interface DayParams {
  dayId: string;
}

interface CreateCourierBody {
  name?: unknown;
}

interface OpenDayBody {
  dailyRateCents?: unknown;
}

interface PeriodQuery {
  from?: string;
  to?: string;
}

export function registerDeliveryRoutes(
  app: FastifyInstance,
  deliveries: DeliveryRepository,
) {
  app.get(
    "/delivery/couriers",
    { config: { permission: "deliveries.read" } },
    async (request, reply) => {
      try {
        return {
          couriers: await deliveries.listCouriers(
            requireAuthUser(request).establishment.id,
          ),
        };
      } catch (error) {
        app.log.error(error, "Delivery courier query failed");

        return reply.code(503).send({
          status: "error",
          message: "Delivery couriers unavailable",
        });
      }
    },
  );

  app.post<{ Body: CreateCourierBody }>(
    "/delivery/couriers",
    { config: { permission: "deliveries.write" } },
    async (request, reply) => {
      try {
        return reply.code(201).send({
          courier: await deliveries.createCourier(
            requireAuthUser(request).establishment.id,
            request.body?.name as string,
            requireAuthUser(request).id,
          ),
        });
      } catch (error) {
        if (error instanceof DeliveryCourierNameError) {
          return reply.code(400).send({
            status: "error",
            message: "Invalid courier name",
          });
        }

        if (error instanceof DeliveryCourierConflictError) {
          return reply.code(409).send({
            status: "error",
            message: "Courier already registered",
          });
        }

        app.log.error(error, "Delivery courier creation failed");

        return reply.code(503).send({
          status: "error",
          message: "Delivery courier unavailable",
        });
      }
    },
  );

  app.get<{ Params: CourierParams; Querystring: PeriodQuery }>(
    "/delivery/couriers/:courierId",
    { config: { permission: "deliveries.read" } },
    async (request, reply) => {
      let period: DeliveryPeriod | undefined;

      if (request.query.from || request.query.to) {
        try {
          period = parseStatementPeriod(request.query.from, request.query.to);
        } catch (error) {
          if (error instanceof StatementPeriodError) {
            return reply.code(400).send({
              status: "error",
              message: "Invalid period",
            });
          }

          throw error;
        }
      }

      try {
        return {
          courier: await deliveries.findCourier(
            requireAuthUser(request).establishment.id,
            request.params.courierId,
            period,
          ),
        };
      } catch (error) {
        if (error instanceof DeliveryCourierNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Courier not found",
          });
        }

        app.log.error(error, "Delivery courier detail query failed");

        return reply.code(503).send({
          status: "error",
          message: "Delivery courier unavailable",
        });
      }
    },
  );

  app.post<{ Body: OpenDayBody; Params: CourierParams }>(
    "/delivery/couriers/:courierId/days",
    { config: { permission: "deliveries.write" } },
    async (request, reply) => {
      let dailyRateCents: number;

      try {
        dailyRateCents = normalizeCents(request.body?.dailyRateCents);
      } catch (error) {
        if (error instanceof DeliveryInputError) {
          return reply.code(400).send({
            status: "error",
            message: "Invalid daily rate",
          });
        }

        throw error;
      }

      try {
        return reply.code(201).send({
          day: await deliveries.openDay(
            requireAuthUser(request).establishment.id,
            request.params.courierId,
            dailyRateCents,
            requireAuthUser(request).id,
          ),
        });
      } catch (error) {
        if (error instanceof DeliveryCourierNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Courier not found",
          });
        }

        if (error instanceof DeliveryDayConflictError) {
          return reply.code(409).send({
            status: "error",
            message: "Courier already has an open day",
          });
        }

        app.log.error(error, "Delivery day creation failed");

        return reply.code(503).send({
          status: "error",
          message: "Delivery day unavailable",
        });
      }
    },
  );

  app.get<{ Params: DayParams }>(
    "/delivery/days/:dayId",
    { config: { permission: "deliveries.read" } },
    async (request, reply) => {
      try {
        return {
          day: await deliveries.findDay(
            requireAuthUser(request).establishment.id,
            request.params.dayId,
          ),
        };
      } catch (error) {
        return sendDayError(app, reply, error, "Delivery day query failed");
      }
    },
  );

  app.post<{ Params: DayParams }>(
    "/delivery/days/:dayId/deliveries",
    { config: { permission: "deliveries.write" } },
    async (request, reply) => {
      let input;

      try {
        input = normalizeDeliveryInput(request.body);
      } catch (error) {
        if (error instanceof DeliveryInputError) {
          return reply.code(400).send({
            status: "error",
            message: "Invalid delivery",
          });
        }

        throw error;
      }

      try {
        return reply.code(201).send({
          day: await deliveries.recordDelivery(
            requireAuthUser(request).establishment.id,
            request.params.dayId,
            input,
            requireAuthUser(request).id,
          ),
        });
      } catch (error) {
        return sendDayError(app, reply, error, "Delivery record failed");
      }
    },
  );

  app.post<{ Params: DayParams }>(
    "/delivery/days/:dayId/expenses",
    { config: { permission: "deliveries.write" } },
    async (request, reply) => {
      let input;

      try {
        input = normalizeExpenseInput(request.body);
      } catch (error) {
        if (error instanceof DeliveryInputError) {
          return reply.code(400).send({
            status: "error",
            message: "Invalid expense",
          });
        }

        throw error;
      }

      try {
        return reply.code(201).send({
          day: await deliveries.addExpense(
            requireAuthUser(request).establishment.id,
            request.params.dayId,
            input,
            requireAuthUser(request).id,
          ),
        });
      } catch (error) {
        return sendDayError(app, reply, error, "Delivery expense failed");
      }
    },
  );

  app.post<{ Params: DayParams }>(
    "/delivery/days/:dayId/close",
    { config: { permission: "deliveries.write" } },
    async (request, reply) => {
      try {
        return {
          day: await deliveries.closeDay(
            requireAuthUser(request).establishment.id,
            request.params.dayId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        return sendDayError(app, reply, error, "Delivery day closing failed");
      }
    },
  );
}

function sendDayError(
  app: FastifyInstance,
  reply: {
    code(statusCode: number): {
      send(payload: { message: string; status: string }): unknown;
    };
  },
  error: unknown,
  logMessage: string,
) {
  if (error instanceof DeliveryDayNotFoundError) {
    return reply.code(404).send({
      status: "error",
      message: "Delivery day not found",
    });
  }

  if (error instanceof DeliveryDayConflictError) {
    return reply.code(409).send({
      status: "error",
      message: "Delivery day is not open",
    });
  }

  app.log.error(error, logMessage);

  return reply.code(503).send({
    status: "error",
    message: "Delivery day unavailable",
  });
}
