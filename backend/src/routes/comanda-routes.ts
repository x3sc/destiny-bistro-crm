import { RoleAccessError } from "../role-policy.js";
import { parseCheckoutOptions, CheckoutInputError, CheckoutConflictError } from '../service-fee.js';
import { hasAppPermission } from "../authentication.js";
import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import { normalizeCancellationReason } from "../cancellation-idempotency.js";
import {
  AdditionalUnavailableError,
  ComandaItemConfigurationError,
  ComandaItemNotFoundError,
  ComandaItemQuantityError,
  ComandaBatchConfirmationConflictError,
  ComandaCancellationConflictError,
  ComandaInventoryPermissionError,
  ComandaNotMutableError,
  ComandaNotCancellableError,
  ComandaNotClosableError,
  ComandaNotFoundError,
  ComandaCreditPermissionError,
  ComandaPaymentError,
  PrintDocumentEmptyError,
  ProductUnavailableError,
  type ComandaRepository,
} from "../comanda-repository.js";
import {
  normalizePaymentAllocations,
  PaymentInputError,
} from "../payment-types.js";
import { CounterPrintConflictError } from "../comanda-print-document.js";
import type { ComandaPrintKind } from "../comanda-print-document.js";

interface ComandaParams {
  comandaId: string;
}

interface ComandaItemParams extends ComandaParams {
  itemId: string;
}
interface PrintDocumentQuery {
  kind?: unknown;
  includeServiceFee?: unknown;
  expectedSnapshot?: unknown;
}

interface ComandaConfigurationParams extends ComandaItemParams {
  configurationId: string;
}

interface AddComandaItemBody {
  productId?: unknown;
}

interface ChangeComandaItemBody {
  delta?: unknown;
  pendingQuantity?: unknown;
}

interface ConfirmItemsBatchBody {
  items?: unknown;
  requestId?: unknown;
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

interface CancelComandaBody {
  disposition?: unknown;
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
  app.get("/quick-sales", { config: { permission: "quick-sales.read" } }, async (request, reply) => {
    try {
      return { comandas: await comandas.listQuickSales(requireAuthUser(request).establishment.id) };
    } catch (error) {
      if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
      if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
      app.log.error(error, "Quick sales query failed");
      return reply.code(503).send({ status: "error", message: "Quick sales unavailable" });
    }
  });
  app.post<{ Body: { name?: unknown } }>("/quick-sales", { config: { permission: "quick-sales.write" } }, async (request, reply) => {
    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    if (!name || name.length > 80) {
      return reply.code(400).send({ status: "error", message: "Invalid customer name" });
    }
    try {
      const user = requireAuthUser(request);
      return reply.code(201).send({ comanda: await comandas.openQuickSale(user.establishment.id, name, user.id) });
    } catch (error) {
      if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
      if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
      app.log.error(error, "Quick sale opening failed");
      return reply.code(503).send({ status: "error", message: "Quick sale unavailable" });
    }
  });
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
      if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
      if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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

  app.get<{ Params: ComandaParams }>('/comandas/:comandaId/checkout-summary', { config: { permission: 'comandas.read' } }, async (request, reply) => {
    if (!comandas.checkoutSummary) return reply.code(503).send({ message: 'Checkout unavailable' });
    try { return await comandas.checkoutSummary(requireAuthUser(request).establishment.id, request.params.comandaId); }
    catch (error) {
      if (error instanceof RoleAccessError) return reply.code(403).send({ message: 'Permission denied' });
      if (error instanceof ComandaNotFoundError || (error && typeof error === 'object' && 'code' in error && error.code === 'P2025')) return reply.code(404).send({ message: 'Comanda not found' });
      return reply.code(503).send({ message: 'Checkout unavailable' });
    }
  });

  app.get<{ Params: ComandaParams; Querystring: PrintDocumentQuery }>(
    "/comandas/:comandaId/print-document",
    { config: { permission: "printing.write" } },
    async (request, reply) => {
      if (!isComandaPrintKind(request.query.kind)) {
        return reply.code(400).send({
          status: "error",
          message: "Invalid print document kind",
        });
      }

      try {
        const user = requireAuthUser(request);
        const hasPreview = request.query.includeServiceFee !== undefined || request.query.expectedSnapshot !== undefined;
        if (request.query.kind === 'CHECKOUT_PREVIEW' && (!['true', 'false'].includes(String(request.query.includeServiceFee)) ||
          typeof request.query.expectedSnapshot !== 'string' || !/^[a-f0-9]{64}$/u.test(request.query.expectedSnapshot)) ||
          request.query.kind !== 'CHECKOUT_PREVIEW' && hasPreview) throw new CheckoutInputError();
        return {
          document: await comandas.findPrintDocument(
            user.establishment.id,
            request.params.comandaId,
            request.query.kind,
            user.name,
            request.query.kind === 'CHECKOUT_PREVIEW' ? { includeServiceFee: request.query.includeServiceFee === 'true', expectedSnapshot: request.query.expectedSnapshot as string } : undefined,
          ),
        };
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: 'Account changed; reload before printing' });
        if (error instanceof CheckoutInputError) return reply.code(400).send({ message: 'Invalid checkout input' });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }
        if (error instanceof CounterPrintConflictError) return reply.code(409).send({
          status: 'error', message: 'Deliver or cancel pending items before printing the final counter conference',
        });
        if (error instanceof PrintDocumentEmptyError) {
          return reply.code(409).send({
            status: "error",
            message: "Nothing to print",
          });
        }
        app.log.error(error, "Comanda print document failed");
        return reply.code(503).send({
          status: "error",
          message: "Print document unavailable",
        });
      }
    },
  );

  app.post<{ Body: CancelComandaBody; Params: ComandaParams }>(
    "/comandas/:comandaId/cancel",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      const body = request.body as CancelComandaBody | null | undefined;
      const emptyBody = isEmptyCancelComandaBody(body);
      const input = emptyBody
        ? null
        : parseCancelComandaBody(body as CancelComandaBody);
      if (!emptyBody && !input) {
        return reply.code(400).send({
          status: "error",
          message: "Invalid comanda cancellation",
        });
      }
      try {
        const user = requireAuthUser(request);
        return {
          comanda: await comandas.cancel(
            user.establishment.id,
            request.params.comandaId,
            input,
            user.permissions.includes("inventory.write"),
            user.id,
          ),
        };
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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

        if (error instanceof ComandaInventoryPermissionError) {
          return reply.code(403).send({
            status: "error",
            message: "Missing required permission",
          });
        }

        if (error instanceof ComandaCancellationConflictError) {
          return reply.code(409).send({
            status: "error",
            message: "Idempotency key already used",
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
      let checkout;
      try {
        checkout = parseCheckoutOptions(body ?? {});
        payments = normalizePaymentAllocations(body?.payments ?? []);
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof CheckoutInputError) return reply.code(400).send({ message: 'Invalid checkout input' });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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
            hasAppPermission(user, "credits.write"),
            user.id,
            ...(checkout ? [checkout] : []),
          ),
        };
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: 'Account changed or idempotency key reused; reload' });
        if (error instanceof CheckoutInputError) return reply.code(400).send({ message: 'Invalid checkout input' });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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
      const hasDelta =
        request.body?.delta === 1 || request.body?.delta === -1;
      const hasPendingQuantity =
        Number.isInteger(request.body?.pendingQuantity) &&
        Number(request.body.pendingQuantity) >= 1 &&
        Number(request.body.pendingQuantity) <= 99;
      if (!request.body || hasDelta === hasPendingQuantity) {
        return reply.code(409).send({
          status: "error",
          message: "Invalid item quantity change",
        });
      }

      try {
        return {
          comanda: hasPendingQuantity
            ? await comandas.setItemPendingQuantity(
                requireAuthUser(request).establishment.id,
                request.params.comandaId,
                request.params.itemId,
                Number(request.body.pendingQuantity),
                requireAuthUser(request).id,
              )
            : await comandas.changeItemQuantity(
                requireAuthUser(request).establishment.id,
                request.params.comandaId,
                request.params.itemId,
                request.body.delta as 1 | -1,
                requireAuthUser(request).id,
              ),
        };
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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
        return await comandas.confirmItem(
          requireAuthUser(request).establishment.id,
          request.params.comandaId,
          request.params.itemId,
          requireAuthUser(request).id,
        );
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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

  app.post<{ Body: ConfirmItemsBatchBody; Params: ComandaParams }>(
    "/comandas/:comandaId/items/confirm-batch",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      const input = normalizeConfirmItemsBatch(request.body);
      if (!input) {
        return reply.code(400).send({
          message: "Invalid batch confirmation",
          status: "error",
        });
      }
      try {
        const user = requireAuthUser(request);
        return await comandas.confirmItemsBatch(
          user.establishment.id,
          request.params.comandaId,
          input,
          user.id,
        );
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
        if (
          error instanceof ComandaBatchConfirmationConflictError ||
          isItemConflict(error)
        ) {
          return reply.code(409).send({
            message: "Comanda items changed; reload before confirming",
            status: "error",
          });
        }
        if (
          error instanceof ComandaNotFoundError ||
          error instanceof ComandaItemNotFoundError
        ) {
          return reply.code(404).send({
            message: "Comanda not found",
            status: "error",
          });
        }
        app.log.error(error, "Comanda batch confirmation failed");
        return reply.code(503).send({
          message: "Comanda unavailable",
          status: "error",
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
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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
      const body = normalizeCancelConfiguration(request.body);
      if (!body) {
        return reply.code(400).send({
          status: "error",
          message: "Invalid item cancellation",
        });
      }
      const user = requireAuthUser(request);
      if (!user.permissions.includes("inventory.write")) {
        return reply.code(403).send({ status: "error", message: "Permission denied" });
      }
      try {
        return await comandas.cancelItemConfiguration(
          user.establishment.id,
          request.params.comandaId,
          request.params.itemId,
          request.params.configurationId,
          body,
          user.id,
        );
      } catch (error) {
        if (error instanceof CheckoutConflictError) return reply.code(409).send({ message: "Account changed or total below recorded payments; reload" });
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
        if (
          error instanceof ComandaNotFoundError ||
          error instanceof ComandaItemNotFoundError
        ) {
          return reply.code(404).send({ status: "error", message: "Comanda item not found" });
        }
        if (error instanceof ComandaCancellationConflictError) {
          return reply.code(409).send({
            status: "error",
            message: "Idempotency key already used",
          });
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

  app.delete<{ Params: ComandaParams }>(
    "/comandas/:comandaId/items/pending",
    { config: { permission: "comandas.write" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          comanda: await comandas.discardPendingItems(
            user.establishment.id,
            request.params.comandaId,
            user.id,
          ),
        };
      } catch (error) {
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
        if (error instanceof ComandaNotFoundError) {
          return reply.code(404).send({
            status: "error",
            message: "Comanda not found",
          });
        }
        if (isItemConflict(error)) {
          return reply.code(409).send({
            status: "error",
            message: "Comanda items cannot be changed",
          });
        }
        app.log.error(error, "Pending comanda item removal failed");
        return reply.code(503).send({
          status: "error",
          message: "Comanda unavailable",
        });
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
        if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
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

function isComandaPrintKind(value: unknown): value is ComandaPrintKind {
  return value === "CONFIRMED" || value === "KITCHEN_PENDING" || value === 'CHECKOUT_PREVIEW' || value === 'COUNTER_PENDING' || value === 'COUNTER_FINAL';
}

function isEmptyCancelComandaBody(
  body: CancelComandaBody | null | undefined,
) {
  return (
    body == null ||
    (typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 0)
  );
}

function parseCancelComandaBody(body: CancelComandaBody): {
  disposition?: "RETURN_TO_STOCK" | "LOSS";
  reason: string;
  requestId: string;
} | null {
  const reason =
    typeof body.reason === "string"
      ? normalizeCancellationReason(body.reason)
      : "";
  if (
    (body.disposition !== undefined &&
      body.disposition !== "RETURN_TO_STOCK" &&
      body.disposition !== "LOSS") ||
    reason.length < 2 ||
    reason.length > 255 ||
    typeof body.requestId !== "string" ||
    body.requestId.length < 8 ||
    body.requestId.length > 191
  ) {
    return null;
  }
  return {
    ...(body.disposition ? { disposition: body.disposition } : {}),
    reason,
    requestId: body.requestId,
  };
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
  const reason =
    typeof body?.reason === "string"
      ? normalizeCancellationReason(body.reason)
      : "";
  const quantity =
    typeof body?.quantity === "number"
      ? body.quantity
      : Number.NaN;
  if (
    !body ||
    (body.disposition !== "RETURN_TO_STOCK" && body.disposition !== "LOSS") ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    reason.length < 2 ||
    reason.length > 255 ||
    typeof body.requestId !== "string" ||
    body.requestId.length < 8 ||
    body.requestId.length > 191
  ) {
    return null;
  }
  return {
    disposition: body.disposition,
    quantity,
    reason,
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

function normalizeConfirmItemsBatch(body: ConfirmItemsBatchBody | undefined) {
  if (
    !body ||
    typeof body.requestId !== "string" ||
    body.requestId.length < 8 ||
    body.requestId.length > 191 ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100
  ) {
    return null;
  }
  const items = body.items.flatMap((value) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const item = value as Record<string, unknown>;
    const valid =
      typeof item.itemId === "string" &&
      item.itemId.length > 0 &&
      item.itemId.length <= 191 &&
      Number.isInteger(item.expectedQuantity) &&
      Number.isInteger(item.expectedConfirmedQuantity) &&
      Number(item.expectedQuantity) > 0 &&
      Number(item.expectedQuantity) <= 99 &&
      Number(item.expectedConfirmedQuantity) >= 0 &&
      Number(item.expectedConfirmedQuantity) < Number(item.expectedQuantity);
    return valid
      ? [
          {
            expectedConfirmedQuantity: Number(
              item.expectedConfirmedQuantity,
            ),
            expectedQuantity: Number(item.expectedQuantity),
            itemId: item.itemId as string,
          },
        ]
      : [];
  });
  if (
    items.length !== body.items.length ||
    new Set(items.map(({ itemId }) => itemId)).size !== items.length
  ) {
    return null;
  }
  return { items, requestId: body.requestId };
}
