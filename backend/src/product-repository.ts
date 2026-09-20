import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";

export interface ProductCategorySummary {
  id: string;
  name: string;
}

export interface Product {
  additionals: MenuAdditional[];
  category: ProductCategorySummary;
  description: string | null;
  id: string;
  name: string;
  priceCents: number;
  requiresKitchen: boolean;
}

export interface MenuProduct {
  active: boolean;
  additionals: MenuAdditional[];
  description: string | null;
  id: string;
  name: string;
  priceCents: number;
  recipe: RecipeIngredient[];
  requiresKitchen: boolean;
}

export interface RecipeIngredient {
  ingredient: {
    id: string;
    name: string;
    unit: "UNIT" | "GRAM" | "MILLILITER";
  };
  quantity: number;
}

export interface RecipeIngredientOption {
  id: string;
  name: string;
  unit: "UNIT" | "GRAM" | "MILLILITER";
}

export interface MenuAdditional {
  active: boolean;
  code: string;
  id: string;
  name: string;
  priceCents: number;
  recipe: RecipeIngredient[];
}

export interface RecipeInput {
  ingredientId: string;
  quantity: number;
}

export interface AdditionalInput {
  active?: boolean;
  code: string;
  name: string;
  priceCents: number;
}

export interface MenuCategory {
  active: boolean;
  id: string;
  name: string;
  products: MenuProduct[];
}

export interface CreateCategoryInput {
  name: string;
}

export interface UpdateCategoryInput extends CreateCategoryInput {
  active: boolean;
}

export interface CreateProductInput {
  categoryId: string;
  description: string | null;
  name: string;
  priceCents: number;
  requiresKitchen: boolean;
}

export interface UpdateProductInput extends CreateProductInput {
  active: boolean;
}

export interface ProductRepository {
  createAdditional(
    establishmentId: string,
    input: AdditionalInput,
    actorUserId: string,
  ): Promise<MenuAdditional>;
  createCategory(
    establishmentId: string,
    input: CreateCategoryInput,
    actorUserId: string,
  ): Promise<MenuCategory>;
  createProduct(
    establishmentId: string,
    input: CreateProductInput,
    actorUserId: string,
  ): Promise<MenuProduct>;
  deactivateCategory(
    establishmentId: string,
    categoryId: string,
    actorUserId: string,
  ): Promise<MenuCategory>;
  deactivateProduct(
    establishmentId: string,
    productId: string,
    actorUserId: string,
  ): Promise<MenuProduct>;
  deactivateAdditional(
    establishmentId: string,
    additionalId: string,
    actorUserId: string,
  ): Promise<MenuAdditional>;
  listAdditionals(establishmentId: string): Promise<MenuAdditional[]>;
  listActive(establishmentId: string): Promise<Product[]>;
  listMenu(establishmentId: string): Promise<MenuCategory[]>;
  listRecipeIngredients(establishmentId: string): Promise<RecipeIngredientOption[]>;
  replaceAdditionalRecipe(
    establishmentId: string,
    additionalId: string,
    recipe: RecipeInput[],
    actorUserId: string,
  ): Promise<MenuAdditional>;
  replaceProductAdditionals(
    establishmentId: string,
    productId: string,
    additionalIds: string[],
    actorUserId: string,
  ): Promise<MenuProduct>;
  replaceProductRecipe(
    establishmentId: string,
    productId: string,
    recipe: RecipeInput[],
    actorUserId: string,
  ): Promise<MenuProduct>;
  updateCategory(
    establishmentId: string,
    categoryId: string,
    input: UpdateCategoryInput,
    actorUserId: string,
  ): Promise<MenuCategory>;
  updateProduct(
    establishmentId: string,
    productId: string,
    input: UpdateProductInput,
    actorUserId: string,
  ): Promise<MenuProduct>;
  updateAdditional(
    establishmentId: string,
    additionalId: string,
    input: AdditionalInput & { active: boolean },
    actorUserId: string,
  ): Promise<MenuAdditional>;
}

export class MenuInputError extends Error {}
export class MenuConflictError extends Error {}
export class MenuCategoryNotFoundError extends Error {}
export class MenuProductNotFoundError extends Error {}
export class MenuAdditionalNotFoundError extends Error {}

const recipeSelect = {
  ingredient: { select: { id: true, name: true, unit: true } },
  quantity: true,
} as const;

const additionalSelect = {
  active: true,
  code: true,
  id: true,
  ingredients: { orderBy: { ingredient: { name: "asc" as const } }, select: recipeSelect },
  name: true,
  priceCents: true,
} satisfies Prisma.AdditionalSelect;

const menuProductSelect = {
  active: true,
  allowedAdditionals: {
    orderBy: { additional: { name: "asc" as const } },
    select: { additional: { select: additionalSelect } },
  },
  description: true,
  id: true,
  name: true,
  priceCents: true,
  requiresKitchen: true,
  ingredients: {
    orderBy: { ingredient: { name: "asc" as const } },
    select: recipeSelect,
  },
} satisfies Prisma.ProductSelect;

const menuCategorySelect = {
  active: true,
  id: true,
  name: true,
  products: {
    orderBy: { name: "asc" as const },
    select: menuProductSelect,
  },
} satisfies Prisma.MenuCategorySelect;

export function createProductRepository(prisma: PrismaClient): ProductRepository {
  return {
    async createAdditional(establishmentId, rawInput, actorUserId) {
      const input = normalizeAdditionalInput(rawInput, false);
      try {
        return await prisma.$transaction(async (transaction) => {
          const additional = await transaction.additional.create({
            data: { ...input, active: true, establishmentId },
            select: additionalSelect,
          });
          await recordMenuAudit(transaction, {
            action: "ADDITIONAL_CREATED",
            actorUserId,
            establishmentId,
            metadata: input,
            resourceId: additional.id,
            resourceType: "ADDITIONAL",
          });
          return mapAdditional(additional);
        });
      } catch (error) {
        throwMappedConflict(error);
      }
    },
    async createCategory(establishmentId, rawInput, actorUserId) {
      const input = normalizeCategoryInput(rawInput);

      try {
        return await prisma.$transaction(async (transaction) => {
          const category = await transaction.menuCategory.create({
            data: {
              establishmentId,
              name: input.name,
              normalizedName: normalizeName(input.name),
            },
            select: menuCategorySelect,
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "MENU_CATEGORY_CREATED",
              establishmentId,
              metadata: { name: input.name },
              resourceId: category.id,
              resourceType: "MENU_CATEGORY",
              userId: actorUserId,
            }),
          });
          return mapMenuCategory(category);
        });
      } catch (error) {
        throwMappedConflict(error);
      }
    },
    async createProduct(establishmentId, rawInput, actorUserId) {
      const input = normalizeProductInput(rawInput);

      try {
        return await prisma.$transaction(async (transaction) => {
          await requireCategory(
            transaction,
            establishmentId,
            input.categoryId,
            true,
          );
          const product = await transaction.product.create({
            data: {
              categoryId: input.categoryId,
              code: `ADMIN_${randomUUID().replaceAll("-", "").toUpperCase()}`,
              description: input.description,
              establishmentId,
              name: input.name,
              priceCents: input.priceCents,
              requiresKitchen: input.requiresKitchen,
            },
            select: menuProductSelect,
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "MENU_PRODUCT_CREATED",
              establishmentId,
              metadata: {
                categoryId: input.categoryId,
                description: input.description,
                name: input.name,
                priceCents: input.priceCents,
                requiresKitchen: input.requiresKitchen,
              },
              resourceId: product.id,
              resourceType: "PRODUCT",
              userId: actorUserId,
            }),
          });
          return mapMenuProduct(product);
        });
      } catch (error) {
        throwMappedConflict(error);
      }
    },
    async deactivateCategory(establishmentId, categoryId, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        await requireCategory(transaction, establishmentId, categoryId);
        await transaction.product.updateMany({
          data: { active: false },
          where: { categoryId, establishmentId },
        });
        const category = await transaction.menuCategory.update({
          data: { active: false },
          select: menuCategorySelect,
          where: { id: categoryId },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "MENU_CATEGORY_DEACTIVATED",
            establishmentId,
            metadata: { deactivatedProductCount: category.products.length },
            resourceId: categoryId,
            resourceType: "MENU_CATEGORY",
            userId: actorUserId,
          }),
        });
        return mapMenuCategory(category);
      });
    },
    async deactivateProduct(establishmentId, productId, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        await requireProduct(transaction, establishmentId, productId);
        const product = await transaction.product.update({
          data: { active: false },
          select: menuProductSelect,
          where: { id: productId },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "MENU_PRODUCT_DEACTIVATED",
            establishmentId,
            resourceId: productId,
            resourceType: "PRODUCT",
            userId: actorUserId,
          }),
        });
        return mapMenuProduct(product);
      });
    },
    async deactivateAdditional(establishmentId, additionalId, actorUserId) {
      return prisma.$transaction(async (transaction) => {
        await requireAdditional(transaction, establishmentId, additionalId);
        const additional = await transaction.additional.update({
          data: { active: false },
          select: additionalSelect,
          where: { id: additionalId },
        });
        await recordMenuAudit(transaction, {
          action: "ADDITIONAL_DEACTIVATED",
          actorUserId,
          establishmentId,
          resourceId: additionalId,
          resourceType: "ADDITIONAL",
        });
        return mapAdditional(additional);
      });
    },
    async listAdditionals(establishmentId) {
      const additionals = await prisma.additional.findMany({
        orderBy: { name: "asc" },
        select: additionalSelect,
        where: { establishmentId },
      });
      return additionals.map(mapAdditional);
    },
    async listActive(establishmentId) {
      const products = await prisma.product.findMany({
        orderBy: { name: "asc" },
        select: {
          allowedAdditionals: {
            orderBy: { additional: { name: "asc" } },
            select: { additional: { select: additionalSelect } },
            where: { additional: { active: true } },
          },
          category: { select: { id: true, name: true } },
          description: true,
          id: true,
          name: true,
          priceCents: true,
          requiresKitchen: true,
        },
        where: {
          active: true,
          category: { active: true },
          establishmentId,
        },
      });
      return products.map((product) => ({
        additionals: product.allowedAdditionals.map(({ additional }) =>
          mapAdditional(additional),
        ),
        category: product.category,
        description: product.description,
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        requiresKitchen: product.requiresKitchen,
      }));
    },
    async listMenu(establishmentId) {
      const categories = await prisma.menuCategory.findMany({
        orderBy: { name: "asc" },
        select: menuCategorySelect,
        where: { establishmentId },
      });
      return categories.map(mapMenuCategory);
    },
    async listRecipeIngredients(establishmentId) {
      return prisma.ingredient.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, unit: true },
        where: { active: true, establishmentId },
      });
    },
    async replaceAdditionalRecipe(
      establishmentId,
      additionalId,
      rawRecipe,
      actorUserId,
    ) {
      const recipe = normalizeRecipe(rawRecipe);
      return prisma.$transaction(async (transaction) => {
        await requireAdditional(transaction, establishmentId, additionalId);
        await requireIngredients(transaction, establishmentId, recipe);
        await transaction.additionalIngredient.deleteMany({
          where: { additionalId, establishmentId },
        });
        if (recipe.length > 0) {
          await transaction.additionalIngredient.createMany({
            data: recipe.map((item) => ({
              additionalId,
              establishmentId,
              ingredientId: item.ingredientId,
              quantity: item.quantity,
            })),
          });
        }
        await recordMenuAudit(transaction, {
          action: "ADDITIONAL_RECIPE_UPDATED",
          actorUserId,
          establishmentId,
          metadata: { recipe },
          resourceId: additionalId,
          resourceType: "ADDITIONAL",
        });
        return mapAdditional(
          await transaction.additional.findUniqueOrThrow({
            select: additionalSelect,
            where: { id: additionalId },
          }),
        );
      });
    },
    async replaceProductAdditionals(
      establishmentId,
      productId,
      rawAdditionalIds,
      actorUserId,
    ) {
      const additionalIds = [...new Set(rawAdditionalIds.map((id) => id.trim()))];
      if (additionalIds.some((id) => !id) || additionalIds.length !== rawAdditionalIds.length) {
        throw new MenuInputError();
      }
      return prisma.$transaction(async (transaction) => {
        await requireProduct(transaction, establishmentId, productId);
        const count = await transaction.additional.count({
          where: { active: true, establishmentId, id: { in: additionalIds } },
        });
        if (count !== additionalIds.length) {
          throw new MenuAdditionalNotFoundError();
        }
        await transaction.productAdditional.deleteMany({
          where: { establishmentId, productId },
        });
        if (additionalIds.length > 0) {
          await transaction.productAdditional.createMany({
            data: additionalIds.map((additionalId) => ({
              additionalId,
              establishmentId,
              productId,
            })),
          });
        }
        await recordMenuAudit(transaction, {
          action: "PRODUCT_ADDITIONALS_UPDATED",
          actorUserId,
          establishmentId,
          metadata: { additionalIds },
          resourceId: productId,
          resourceType: "PRODUCT",
        });
        return mapMenuProduct(
          await transaction.product.findUniqueOrThrow({
            select: menuProductSelect,
            where: { id: productId },
          }),
        );
      });
    },
    async replaceProductRecipe(
      establishmentId,
      productId,
      rawRecipe,
      actorUserId,
    ) {
      const recipe = normalizeRecipe(rawRecipe);
      return prisma.$transaction(async (transaction) => {
        await requireProduct(transaction, establishmentId, productId);
        await requireIngredients(transaction, establishmentId, recipe);
        await transaction.productIngredient.deleteMany({
          where: { establishmentId, productId },
        });
        if (recipe.length > 0) {
          await transaction.productIngredient.createMany({
            data: recipe.map((item) => ({
              establishmentId,
              ingredientId: item.ingredientId,
              productId,
              quantity: item.quantity,
            })),
          });
        }
        await recordMenuAudit(transaction, {
          action: "PRODUCT_RECIPE_UPDATED",
          actorUserId,
          establishmentId,
          metadata: { recipe },
          resourceId: productId,
          resourceType: "PRODUCT",
        });
        return mapMenuProduct(
          await transaction.product.findUniqueOrThrow({
            select: menuProductSelect,
            where: { id: productId },
          }),
        );
      });
    },
    async updateCategory(
      establishmentId,
      categoryId,
      rawInput,
      actorUserId,
    ) {
      const input = normalizeUpdateCategoryInput(rawInput);

      try {
        return await prisma.$transaction(async (transaction) => {
          await requireCategory(transaction, establishmentId, categoryId);
          const category = await transaction.menuCategory.update({
            data: {
              active: input.active,
              name: input.name,
              normalizedName: normalizeName(input.name),
            },
            select: menuCategorySelect,
            where: { id: categoryId },
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "MENU_CATEGORY_UPDATED",
              establishmentId,
              metadata: { active: input.active, name: input.name },
              resourceId: categoryId,
              resourceType: "MENU_CATEGORY",
              userId: actorUserId,
            }),
          });
          return mapMenuCategory(category);
        });
      } catch (error) {
        throwMappedConflict(error);
      }
    },
    async updateProduct(
      establishmentId,
      productId,
      rawInput,
      actorUserId,
    ) {
      const input = normalizeUpdateProductInput(rawInput);

      return prisma.$transaction(async (transaction) => {
        await requireProduct(transaction, establishmentId, productId);
        await requireCategory(
          transaction,
          establishmentId,
          input.categoryId,
          input.active,
        );
        const product = await transaction.product.update({
          data: input,
          select: menuProductSelect,
          where: { id: productId },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "MENU_PRODUCT_UPDATED",
            establishmentId,
            metadata: input,
            resourceId: productId,
            resourceType: "PRODUCT",
            userId: actorUserId,
          }),
        });
        return mapMenuProduct(product);
      });
    },
    async updateAdditional(
      establishmentId,
      additionalId,
      rawInput,
      actorUserId,
    ) {
      const input = normalizeAdditionalInput(rawInput, true);
      try {
        return await prisma.$transaction(async (transaction) => {
          await requireAdditional(transaction, establishmentId, additionalId);
          const additional = await transaction.additional.update({
            data: input,
            select: additionalSelect,
            where: { id: additionalId },
          });
          await recordMenuAudit(transaction, {
            action: "ADDITIONAL_UPDATED",
            actorUserId,
            establishmentId,
            metadata: input,
            resourceId: additionalId,
            resourceType: "ADDITIONAL",
          });
          return mapAdditional(additional);
        });
      } catch (error) {
        throwMappedConflict(error);
      }
    },
  };
}

function normalizeCategoryInput(input: CreateCategoryInput) {
  const name = cleanText(input.name);
  if (name.length < 2 || name.length > 80) {
    throw new MenuInputError();
  }
  return { name };
}

function normalizeUpdateCategoryInput(input: UpdateCategoryInput) {
  if (typeof input.active !== "boolean") {
    throw new MenuInputError();
  }
  return { ...normalizeCategoryInput(input), active: input.active };
}

function normalizeProductInput(input: CreateProductInput) {
  const categoryId = input.categoryId.trim();
  const description = input.description ? cleanText(input.description) : null;
  const name = cleanText(input.name);
  if (
    !categoryId ||
    name.length < 2 ||
    name.length > 100 ||
    (description !== null && description.length > 255) ||
    !Number.isInteger(input.priceCents) ||
    input.priceCents <= 0 ||
    input.priceCents > 99_999_999 ||
    typeof input.requiresKitchen !== "boolean"
  ) {
    throw new MenuInputError();
  }
  return {
    categoryId,
    description,
    name,
    priceCents: input.priceCents,
    requiresKitchen: input.requiresKitchen,
  };
}

function normalizeUpdateProductInput(input: UpdateProductInput) {
  if (typeof input.active !== "boolean") {
    throw new MenuInputError();
  }
  return { ...normalizeProductInput(input), active: input.active };
}

function normalizeAdditionalInput(input: AdditionalInput, requiresActive: boolean) {
  const code = input.code.trim().toLocaleUpperCase("pt-BR");
  const name = cleanText(input.name);
  if (
    !code ||
    code.length > 50 ||
    name.length < 2 ||
    name.length > 100 ||
    !Number.isInteger(input.priceCents) ||
    input.priceCents < 0 ||
    input.priceCents > 99_999_999 ||
    (requiresActive && typeof input.active !== "boolean")
  ) {
    throw new MenuInputError();
  }
  return {
    active: requiresActive ? input.active : undefined,
    code,
    name,
    priceCents: input.priceCents,
  };
}

function normalizeRecipe(recipe: RecipeInput[]) {
  if (!Array.isArray(recipe)) {
    throw new MenuInputError();
  }
  const normalized = recipe.map((item) => ({
    ingredientId: item.ingredientId.trim(),
    quantity: item.quantity,
  }));
  if (
    normalized.some(
      (item) =>
        !item.ingredientId ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0,
    ) ||
    new Set(normalized.map(({ ingredientId }) => ingredientId)).size !==
      normalized.length
  ) {
    throw new MenuInputError();
  }
  return normalized;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizeName(value: string) {
  return cleanText(value).toLocaleLowerCase("pt-BR");
}

async function requireCategory(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  categoryId: string,
  requireActive = false,
) {
  const category = await transaction.menuCategory.findFirst({
    select: { id: true },
    where: {
      active: requireActive ? true : undefined,
      establishmentId,
      id: categoryId,
    },
  });
  if (!category) {
    throw new MenuCategoryNotFoundError();
  }
}

async function requireProduct(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  productId: string,
) {
  const product = await transaction.product.findFirst({
    select: { id: true },
    where: { establishmentId, id: productId },
  });
  if (!product) {
    throw new MenuProductNotFoundError();
  }
}

async function requireAdditional(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  additionalId: string,
) {
  const additional = await transaction.additional.findFirst({
    select: { id: true },
    where: { establishmentId, id: additionalId },
  });
  if (!additional) {
    throw new MenuAdditionalNotFoundError();
  }
}

async function requireIngredients(
  transaction: Prisma.TransactionClient,
  establishmentId: string,
  recipe: RecipeInput[],
) {
  const count = await transaction.ingredient.count({
    where: {
      active: true,
      establishmentId,
      id: { in: recipe.map(({ ingredientId }) => ingredientId) },
    },
  });
  if (count !== recipe.length) {
    throw new MenuInputError();
  }
}

type PersistedMenuProduct = Prisma.ProductGetPayload<{
  select: typeof menuProductSelect;
}>;
type PersistedAdditional = Prisma.AdditionalGetPayload<{
  select: typeof additionalSelect;
}>;
type PersistedMenuCategory = Prisma.MenuCategoryGetPayload<{
  select: typeof menuCategorySelect;
}>;

function mapAdditional(additional: PersistedAdditional): MenuAdditional {
  const { ingredients, ...summary } = additional;
  return { ...summary, recipe: ingredients };
}

function mapMenuProduct(product: PersistedMenuProduct): MenuProduct {
  const { allowedAdditionals, ingredients, ...summary } = product;
  return {
    ...summary,
    additionals: allowedAdditionals.map(({ additional }) =>
      mapAdditional(additional),
    ),
    recipe: ingredients,
  };
}

function mapMenuCategory(category: PersistedMenuCategory): MenuCategory {
  return {
    active: category.active,
    id: category.id,
    name: category.name,
    products: category.products.map(mapMenuProduct),
  };
}

async function recordMenuAudit(
  transaction: Prisma.TransactionClient,
  input: {
    action: string;
    actorUserId: string;
    establishmentId: string;
    metadata?: Prisma.InputJsonValue;
    resourceId: string;
    resourceType: string;
  },
) {
  await transaction.auditLog.create({
    data: createAuditData({
      action: input.action,
      establishmentId: input.establishmentId,
      metadata: input.metadata,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      userId: input.actorUserId,
    }),
  });
}

function throwMappedConflict(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    throw new MenuConflictError();
  }
  throw error;
}
