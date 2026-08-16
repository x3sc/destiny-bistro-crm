import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  AdditionalUnavailableError,
  ComandaItemConfigurationError,
  ComandaItemNotFoundError,
  ComandaItemQuantityError,
  ComandaNotMutableError,
  ComandaNotCancellableError,
  ComandaNotClosableError,
  ComandaNotFoundError,
  ComandaCreditPermissionError,
  ComandaPaymentError,
  ProductUnavailableError,
  type ComandaRepository,
} from "../comanda-repository.js";
import {
  normalizePaymentAllocations,
  PaymentInputError,
} from "../payment-types.js";

interface ComandaParams {
  comandaId: string;
}

interface ComandaItemParams extends ComandaParams {
  itemId: string;
}

interface ComandaConfigurationParams extends ComandaItemParams {
  configurationId: string;
}

interface AddComandaItemBody {
  productId?: unknown;
}

interface ChangeComandaItemBody {
  delta?: unknown;
}

interface ConfigureAdditionalsBody {
  additionals?: unknown;
  quantity?: unknown;
  requestId?: unknown;
}

interface CancelConfigurationBody {
  disposition?: unknown;
  quantity?: unknown;
  reason?: unknown;
  requestId?: unknown;
}

interface CloseComandaBody {
  customerId?: unknown;
  payments?: unknown;
}

function isItemConflict(error: unknown) {
  return (
    error instanceof ComandaItemQuantityError ||
    error instanceof ComandaNotCancellableError ||
    error instanceof ComandaNotMutableError ||
    error instanceof ProductUnavailableError
  );
}

export function registerComandaRoutes(app: FastifyInstance, comandas: ComandaRepository) {
  app.get<{ Params: ComandaParams }>(
    "/comandas/:comandaId",
    { config: { permission: "comandas.read" } },
    async (request, reply) => {
    try {
      return {
        comanda: await comandas.findById(
          requireAuthUser(request).establishment.id,
          request.params.comandaId,
        ),
      };
    } catch (error) {
      if (error instanceof ComandaNotFoundError) {
        return reply.code(404).send({
          status: "error",
          message: "Comanda not found",
        });
      }

      app.log.error(error, "Comanda query failed");

      return reply.code(503).send({
        status: "error",
        message: "Comanda unavailable",
      });
    }
    },
  );

  app.post<{ Params: ComandaParams }>(
    "/comandas/:comandaId/cancel",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      try {
        return {
          comanda: await comandas.cancel(
            requireAuthUser(request).establishment.id,
            request.params.comandaId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }

        if (error instanceof ComandaNotCancellableError) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda cannot be cancelled",
          });
        }

        app.log.error(error, "Comanda cancellation failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.post<{ Params: ComandaParams }>(
    "/comandas/:comandaId/close",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      const body = request.body as CloseComandaBody | undefined;
      let payments;
      try {
        payments = normalizePaymentAllocations(body?.payments ?? []);
      } catch (error) {
        if (error instanceof PaymentInputError) {
          return reply.code(400).send({
            status: "error",
            message: "Invalid payment allocations",
          });
        }
        throw error;
      }

      const customerId =
        typeof body?.customerId === "string" && body.customerId
          ? body.customerId
          : null;
      const user = requireAuthUser(request);
      try {
        return {
          comanda: await comandas.close(
            user.establishment.id,
            request.params.comandaId,
            payments,
            customerId,
            user.permissions.includes("credits.write"),
            user.id,
          ),
        };
      } catch (error) {
        if (error instanceof ComandaCreditPermissionError) {
          return reply.code(403).send({
            status: "error",
            message: "Permission denied",
          });
        }

        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }

        if (
          error instanceof ComandaNotClosableError ||
          error instanceof ComandaPaymentError
        ) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda cannot be closed",
          });
        }

        app.log.error(error, "Comanda closing failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.post<{ Body: AddComandaItemBody; Params: ComandaParams }>(
    "/comandas/:comandaId/items",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      if (!request.body || typeof request.body.productId !== "string" || !request.body.productId) {
        return reply.code(409).send({
          status: "error",
          message: "Product unavailable",
        });
      }

      try {
        return {
          comanda: await comandas.addItem(
            requireAuthUser(request).establishment.id,
            request.params.comandaId,
            request.body.productId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item creation failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.patch<{ Body: ChangeComandaItemBody; Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      if (!request.body || (request.body.delta !== 1 && request.body.delta !== -1)) {
        return reply.code(409).send({
          status: "error",
          message: "Invalid item quantity change",
        });
      }

      try {
        return {
          comanda: await comandas.changeItemQuantity(
            requireAuthUser(request).establishment.id,
            request.params.comandaId,
            request.params.itemId,
            request.body.delta,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError || error instanceof ComandaItemNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda item not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item quantity change failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.post<{ Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId/confirm",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      try {
        return comandas.confirmItem(
          requireAuthUser(request).establishment.id,
          request.params.comandaId,
          request.params.itemId,
          requireAuthUser(request).id,
        );
      } catch (error) {
        if (
          error instanceof ComandaNotFoundError ||
          error instanceof ComandaItemNotFoundError
        ) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda item not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item confirmation failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );

  app.put<{ Body: ConfigureAdditionalsBody; Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId/additionals",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      const body = normalizeConfigureAdditionals(request.body);
      if (!body) {
        return reply.code(400).send({
          status: "error",
          message: "Invalid item configuration",
        });
      }
      try {
        return {
          comanda: await comandas.configureItemAdditionals(
            requireAuthUser(request).establishment.id,
            request.params.comandaId,
            request.params.itemId,
            body,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (
          error instanceof ComandaNotFoundError ||
          error instanceof ComandaItemNotFoundError
        ) {
          return reply.code(404).send({ status: "error", message: "Comanda item not found" });
        }
        if (
          error instanceof AdditionalUnavailableError ||
          error instanceof ComandaItemConfigurationError ||
          isItemConflict(error)
        ) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be configured",
          });
        }
        app.log.error(error, "Comanda item configuration failed");
        return reply.code(503).send({ status: "error", message: "Comanda unavailable" });
      }
    },
  );

  app.post<{ Body: CancelConfigurationBody; Params: ComandaConfigurationParams }>(
    "/comandas/:comandaId/items/:itemId/configurations/:configurationId/cancel",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      const user = requireAuthUser(request);
      if (!user.permissions.includes("inventory.write")) {
        return reply.code(403).send({ status: "error", message: "Permission denied" });
      }
      const body = normalizeCancelConfiguration(request.body);
      if (!body) {
        return reply.code(400).send({
          status: "error",
          message: "Invalid item cancellation",
        });
      }
      try {
        return comandas.cancelItemConfiguration(
          user.establishment.id,
          request.params.comandaId,
          request.params.itemId,
          request.params.configurationId,
          body,
          user.id,
        );
      } catch (error) {
        if (
          error instanceof ComandaNotFoundError ||
          error instanceof ComandaItemNotFoundError
        ) {
          return reply.code(404).send({ status: "error", message: "Comanda item not found" });
        }
        if (error instanceof ComandaItemConfigurationError || isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be cancelled",
          });
        }
        app.log.error(error, "Comanda item cancellation failed");
        return reply.code(503).send({ status: "error", message: "Comanda unavailable" });
      }
    },
  );

  app.delete<{ Params: ComandaItemParams }>(
    "/comandas/:comandaId/items/:itemId",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      try {
        return {
          comanda: await comandas.removeItem(
            requireAuthUser(request).establishment.id,
            request.params.comandaId,
            request.params.itemId,
            requireAuthUser(request).id,
          ),
        };
      } catch (error) {
        if (error instanceof ComandaNotFoundError || error instanceof ComandaItemNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda item not found",
          });
        }

        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda item cannot be changed",
          });
        }

        app.log.error(error, "Comanda item removal failed");

        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
      }
    },
  );
}

function normalizeConfigureAdditionals(body: ConfigureAdditionalsBody | undefined) {
  if (
    !body ||
    !Array.isArray(body.additionals) ||
    typeof body.quantity !== "number" ||
    typeof body.requestId !== "string"
  ) {
    return null;
  }
  const values: unknown[] = body.additionals;
  if (!values.every(isAdditionalConfigurationInput)) {
    return null;
  }
  return {
    additionals: values,
    quantity: body.quantity,
    requestId: body.requestId,
  };
}

function normalizeCancelConfiguration(
  body: CancelConfigurationBody | undefined,
): {
  disposition: "RETURN_TO_STOCK" | "LOSS";
  quantity: number;
  reason: string;
  requestId: string;
} | null {
  if (
    !body ||
    (body.disposition !== "RETURN_TO_STOCK" && body.disposition !== "LOSS") ||
    typeof body.quantity !== "number" ||
    typeof body.reason !== "string" ||
    typeof body.requestId !== "string"
  ) {
    return null;
  }
  const disposition: "RETURN_TO_STOCK" | "LOSS" = body.disposition;
  return {
    disposition,
    quantity: body.quantity,
    reason: body.reason,
    requestId: body.requestId,
  };
}

function isAdditionalConfigurationInput(
  value: unknown,
): value is { additionalId: string; quantityPerUnit: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "additionalId" in value &&
      typeof value.additionalId === "string" &&
      "quantityPerUnit" in value &&
      typeof value.quantityPerUnit === "number",
  );
}
