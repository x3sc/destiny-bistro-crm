import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

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

export interface CategoryInput {
  name: string;
}

export interface ProductInput {
  categoryId: string;
  description: string | null;
  name: string;
  priceCents: number;
}

export async function loadAdminMenu(apiBaseUrl: string) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}/admin/menu`);
  if (!response.ok) {
    throw new Error('Não foi possível carregar o cardápio.');
  }
  const payload: unknown = await response.json();
  const categories = objectValue(payload, 'categories');
  if (!Array.isArray(categories) || !categories.every(isMenuCategory)) {
    throw new Error('Resposta inválida do cardápio.');
  }
  return categories;
}

export async function createMenuCategory(apiBaseUrl: string, input: CategoryInput) {
  return categoryMutation(apiBaseUrl, '/admin/categories', 'POST', input);
}

export async function updateMenuCategory(
  apiBaseUrl: string,
  categoryId: string,
  input: CategoryInput & { active: boolean },
) {
  return categoryMutation(
    apiBaseUrl,
    `/admin/categories/${encodeURIComponent(categoryId)}`,
    'PATCH',
    input,
  );
}

export async function deleteMenuCategory(apiBaseUrl: string, categoryId: string) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE' },
  );
  return readCategory(response);
}

export async function createMenuProduct(apiBaseUrl: string, input: ProductInput) {
  return productMutation(apiBaseUrl, '/admin/products', 'POST', input);
}

export async function updateMenuProduct(
  apiBaseUrl: string,
  productId: string,
  input: ProductInput & { active: boolean },
) {
  return productMutation(
    apiBaseUrl,
    `/admin/products/${encodeURIComponent(productId)}`,
    'PATCH',
    input,
  );
}

export async function deleteMenuProduct(apiBaseUrl: string, productId: string) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/products/${encodeURIComponent(productId)}`,
    { method: 'DELETE' },
  );
  return readProduct(response);
}

async function categoryMutation(
  apiBaseUrl: string,
  path: string,
  method: 'PATCH' | 'POST',
  input: CategoryInput & { active?: boolean },
) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}${path}`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method,
  });
  return readCategory(response);
}

async function productMutation(
  apiBaseUrl: string,
  path: string,
  method: 'PATCH' | 'POST',
  input: ProductInput & { active?: boolean },
) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}${path}`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method,
  });
  return readProduct(response);
}

async function readCategory(response: Response) {
  if (!response.ok) {
    throw new Error('Não foi possível salvar a categoria.');
  }
  const payload: unknown = await response.json();
  const category = objectValue(payload, 'category');
  if (!isMenuCategory(category)) {
    throw new Error('Resposta inválida da categoria.');
  }
  return category;
}

async function readProduct(response: Response) {
  if (!response.ok) {
    throw new Error('Não foi possível salvar o item.');
  }
  const payload: unknown = await response.json();
  const product = objectValue(payload, 'product');
  if (!isMenuProduct(product)) {
    throw new Error('Resposta inválida do item.');
  }
  return product;
}

function isMenuCategory(value: unknown): value is MenuCategory {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const category = value as Partial<MenuCategory>;
  return (
    typeof category.active === 'boolean' &&
    typeof category.id === 'string' &&
    typeof category.name === 'string' &&
    Array.isArray(category.products) &&
    category.products.every(isMenuProduct)
  );
}

function isMenuProduct(value: unknown): value is MenuProduct {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const product = value as Partial<MenuProduct>;
  return (
    typeof product.active === 'boolean' &&
    (product.description === null || typeof product.description === 'string') &&
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    Number.isInteger(product.priceCents) &&
    Number(product.priceCents) > 0
  );
}

function objectValue(value: unknown, key: string) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function baseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    throw new Error('URL da API não configurada.');
  }
  return normalized;
}
