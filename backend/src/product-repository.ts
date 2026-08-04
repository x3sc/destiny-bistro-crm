import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";

export interface ProductCategorySummary {
  id: string;
  name: string;
}

export interface Product {
  category: ProductCategorySummary;
  description: string | null;
  id: string;
  name: string;
  priceCents: number;
}

export interface MenuProduct {
  active: boolean;
  description: string | null;
  id: string;
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
}

export interface UpdateProductInput extends CreateProductInput {
  active: boolean;
}

export interface ProductRepository {
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
  listActive(establishmentId: string): Promise<Product[]>;
  listMenu(establishmentId: string): Promise<MenuCategory[]>;
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
}

export class MenuInputError extends Error {}
export class MenuConflictError extends Error {}
export class MenuCategoryNotFoundError extends Error {}
export class MenuProductNotFoundError extends Error {}

const menuProductSelect = {
  active: true,
  description: true,
  id: true,
  name: true,
  priceCents: true,
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
          return category;
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
              },
              resourceId: product.id,
              resourceType: "PRODUCT",
              userId: actorUserId,
            }),
          });
          return product;
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
        return category;
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
        return product;
      });
    },
    async listActive(establishmentId) {
      return prisma.product.findMany({
        orderBy: { name: "asc" },
        select: {
          category: { select: { id: true, name: true } },
          description: true,
          id: true,
          name: true,
          priceCents: true,
        },
        where: {
          active: true,
          category: { active: true },
          establishmentId,
        },
      });
    },
    async listMenu(establishmentId) {
      return prisma.menuCategory.findMany({
        orderBy: { name: "asc" },
        select: menuCategorySelect,
        where: { establishmentId },
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
          return category;
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
        return product;
      });
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
    input.priceCents > 99_999_999
  ) {
    throw new MenuInputError();
  }
  return { categoryId, description, name, priceCents: input.priceCents };
}

function normalizeUpdateProductInput(input: UpdateProductInput) {
  if (typeof input.active !== "boolean") {
    throw new MenuInputError();
  }
  return { ...normalizeProductInput(input), active: input.active };
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
