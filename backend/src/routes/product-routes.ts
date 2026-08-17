import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  MenuCategoryNotFoundError,
  MenuConflictError,
  MenuInputError,
  MenuAdditionalNotFoundError,
  MenuProductNotFoundError,
  type ProductRepository,
} from "../product-repository.js";

interface EntityParams {
  entityId: string;
}

interface CategoryBody {
  active?: unknown;
  name?: unknown;
}

interface ProductBody {
  active?: unknown;
  categoryId?: unknown;
  description?: unknown;
  name?: unknown;
  priceCents?: unknown;
}

interface AdditionalBody {
  active?: unknown;
  code?: unknown;
  name?: unknown;
  priceCents?: unknown;
}

interface RecipeBody {
  recipe?: unknown;
}

interface ProductAdditionalsBody {
  additionalIds?: unknown;
}

export function registerProductRoutes(
  app: FastifyInstance,
  products: ProductRepository,
) {
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
        return unavailable(reply);
      }
    },
  );

  app.get(
    "/admin/additionals",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      try {
        return {
          additionals: await products.listAdditionals(
            requireAuthUser(request).establishment.id,
          ),
        };
      } catch (error) {
        app.log.error(error, "Additional query failed");
        return unavailable(reply);
      }
    },
  );

  app.get(
    "/admin/menu",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      try {
        return {
          categories: await products.listMenu(
            requireAuthUser(request).establishment.id,
          ),
        };
      } catch (error) {
        app.log.error(error, "Administrative menu query failed");
        return unavailable(reply);
      }
    },
  );

  app.post<{ Body: CategoryBody }>(
    "/admin/categories",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (!request.body || typeof request.body.name !== "string") {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        const category = await products.createCategory(
          user.establishment.id,
          { name: request.body.name },
          user.id,
        );
        return reply.code(201).send({ category });
      } catch (error) {
        return handleMenuError(app, reply, error, "Category creation failed");
      }
    },
  );

  app.patch<{ Body: CategoryBody; Params: EntityParams }>(
    "/admin/categories/:entityId",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (
        !request.body ||
        typeof request.body.active !== "boolean" ||
        typeof request.body.name !== "string"
      ) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          category: await products.updateCategory(
            user.establishment.id,
            request.params.entityId,
            { active: request.body.active, name: request.body.name },
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Category update failed");
      }
    },
  );

  app.delete<{ Params: EntityParams }>(
    "/admin/categories/:entityId",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          category: await products.deactivateCategory(
            user.establishment.id,
            request.params.entityId,
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(
          app,
          reply,
          error,
          "Category deactivation failed",
        );
      }
    },
  );

  app.post<{ Body: ProductBody }>(
    "/admin/products",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (!isProductBody(request.body, false)) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        const product = await products.createProduct(
          user.establishment.id,
          productInput(request.body),
          user.id,
        );
        return reply.code(201).send({ product });
      } catch (error) {
        return handleMenuError(app, reply, error, "Product creation failed");
      }
    },
  );

  app.patch<{ Body: ProductBody; Params: EntityParams }>(
    "/admin/products/:entityId",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (!isProductBody(request.body, true)) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          product: await products.updateProduct(
            user.establishment.id,
            request.params.entityId,
            { ...productInput(request.body), active: request.body.active },
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Product update failed");
      }
    },
  );

  app.delete<{ Params: EntityParams }>(
    "/admin/products/:entityId",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          product: await products.deactivateProduct(
            user.establishment.id,
            request.params.entityId,
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(
          app,
          reply,
          error,
          "Product deactivation failed",
        );
      }
    },
  );

  app.get(
    "/admin/recipe-ingredients",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      try {
        return {
          ingredients: await products.listRecipeIngredients(
            requireAuthUser(request).establishment.id,
          ),
        };
      } catch (error) {
        app.log.error(error, "Recipe ingredient query failed");
        return unavailable(reply);
      }
    },
  );

  app.put<{ Body: RecipeBody; Params: EntityParams }>(
    "/admin/products/:entityId/recipe",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      const recipe = parseRecipe(request.body?.recipe);
      if (!recipe) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          product: await products.replaceProductRecipe(
            user.establishment.id,
            request.params.entityId,
            recipe,
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Product recipe update failed");
      }
    },
  );

  app.put<{ Body: ProductAdditionalsBody; Params: EntityParams }>(
    "/admin/products/:entityId/additionals",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (
        !Array.isArray(request.body?.additionalIds) ||
        request.body.additionalIds.some((id) => typeof id !== "string")
      ) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          product: await products.replaceProductAdditionals(
            user.establishment.id,
            request.params.entityId,
            request.body.additionalIds as string[],
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Product additional update failed");
      }
    },
  );

  app.post<{ Body: AdditionalBody }>(
    "/admin/additionals",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (!isAdditionalBody(request.body, false)) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return reply.code(201).send({
          additional: await products.createAdditional(
            user.establishment.id,
            {
              code: request.body.code,
              name: request.body.name,
              priceCents: request.body.priceCents,
            },
            user.id,
          ),
        });
      } catch (error) {
        return handleMenuError(app, reply, error, "Additional creation failed");
      }
    },
  );

  app.patch<{ Body: AdditionalBody; Params: EntityParams }>(
    "/admin/additionals/:entityId",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      if (!isAdditionalBody(request.body, true)) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          additional: await products.updateAdditional(
            user.establishment.id,
            request.params.entityId,
            {
              active: request.body.active,
              code: request.body.code,
              name: request.body.name,
              priceCents: request.body.priceCents,
            },
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Additional update failed");
      }
    },
  );

  app.delete<{ Params: EntityParams }>(
    "/admin/additionals/:entityId",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      try {
        const user = requireAuthUser(request);
        return {
          additional: await products.deactivateAdditional(
            user.establishment.id,
            request.params.entityId,
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Additional deactivation failed");
      }
    },
  );

  app.put<{ Body: RecipeBody; Params: EntityParams }>(
    "/admin/additionals/:entityId/recipe",
    { config: { permission: "products.write" } },
    async (request, reply) => {
      const recipe = parseRecipe(request.body?.recipe);
      if (!recipe) {
        return invalid(reply);
      }
      try {
        const user = requireAuthUser(request);
        return {
          additional: await products.replaceAdditionalRecipe(
            user.establishment.id,
            request.params.entityId,
            recipe,
            user.id,
          ),
        };
      } catch (error) {
        return handleMenuError(app, reply, error, "Additional recipe update failed");
      }
    },
  );
}

function isAdditionalBody(
  body: AdditionalBody | undefined,
  requiresActive: boolean,
): body is AdditionalBody & {
  active: boolean;
  code: string;
  name: string;
  priceCents: number;
} {
  return Boolean(
    body &&
      typeof body.code === "string" &&
      typeof body.name === "string" &&
      typeof body.priceCents === "number" &&
      (!requiresActive || typeof body.active === "boolean"),
  );
}

function parseRecipe(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: unknown[] = value;
  return items.every(isRecipeInput) ? items : null;
}

function isRecipeInput(
  value: unknown,
): value is { ingredientId: string; quantity: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ingredientId" in value &&
      typeof value.ingredientId === "string" &&
      "quantity" in value &&
      typeof value.quantity === "number",
  );
}

function isProductBody(
  body: ProductBody | undefined,
  requiresActive: boolean,
): body is ProductBody & {
  active: boolean;
  categoryId: string;
  description: string | null;
  name: string;
  priceCents: number;
} {
  return Boolean(
    body &&
      typeof body.categoryId === "string" &&
      (body.description === null || typeof body.description === "string") &&
      typeof body.name === "string" &&
      body.name.trim().length >= 2 &&
      typeof body.priceCents === "number" &&
      Number.isInteger(body.priceCents) &&
      body.priceCents > 0 &&
      (!requiresActive || typeof body.active === "boolean"),
  );
}

function productInput(body: ProductBody & {
  categoryId: string;
  description: string | null;
  name: string;
  priceCents: number;
}) {
  return {
    categoryId: body.categoryId,
    description: body.description,
    name: body.name,
    priceCents: body.priceCents,
  };
}

function handleMenuError(
  app: FastifyInstance,
  reply: Reply,
  error: unknown,
  logMessage: string,
) {
  if (error instanceof MenuInputError) {
    return invalid(reply);
  }
  if (error instanceof MenuConflictError) {
    return reply.code(409).send({ message: "Menu entry already exists", status: "error" });
  }
  if (
    error instanceof MenuCategoryNotFoundError ||
    error instanceof MenuProductNotFoundError ||
    error instanceof MenuAdditionalNotFoundError
  ) {
    return reply.code(404).send({ message: "Menu entry not found", status: "error" });
  }
  app.log.error(error, logMessage);
  return unavailable(reply);
}

interface Reply {
  code(statusCode: number): {
    send(payload: unknown): unknown;
  };
}

function invalid(reply: Reply) {
  return reply.code(400).send({ message: "Invalid menu entry", status: "error" });
}

function unavailable(reply: Reply) {
  return reply.code(503).send({ message: "Products unavailable", status: "error" });
}
