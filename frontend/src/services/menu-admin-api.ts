import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export interface MenuProduct {
  active: boolean;
  additionals?: MenuAdditional[];
  description: string | null;
  id: string;
  name: string;
  priceCents: number;
  recipe?: RecipeIngredient[];
  requiresKitchen: boolean;
}

export interface RecipeIngredient {
  ingredient: { id: string; name: string; unit: 'UNIT' | 'GRAM' | 'MILLILITER' };
  quantity: number;
}

export interface RecipeIngredientOption {
  id: string;
  name: string;
  unit: 'UNIT' | 'GRAM' | 'MILLILITER';
}

export interface MenuAdditional {
  active: boolean;
  code: string;
  id: string;
  name: string;
  priceCents: number;
  recipe: RecipeIngredient[];
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
  requiresKitchen: boolean;
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

export async function loadMenuAdditionals(apiBaseUrl: string) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}/admin/additionals`);
  return readArray<MenuAdditional>(response, 'additionals', isMenuAdditional);
}

export async function loadRecipeIngredients(apiBaseUrl: string) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}/admin/recipe-ingredients`);
  return readArray<RecipeIngredientOption>(
    response,
    'ingredients',
    isRecipeIngredientOption,
  );
}

export async function createMenuAdditional(
  apiBaseUrl: string,
  input: { code: string; name: string; priceCents: number },
) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}/admin/additionals`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  return readAdditional(response);
}

export async function deactivateMenuAdditional(apiBaseUrl: string, additionalId: string) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/additionals/${encodeURIComponent(additionalId)}`,
    { method: 'DELETE' },
  );
  return readAdditional(response);
}

export async function updateMenuAdditional(
  apiBaseUrl: string,
  additionalId: string,
  input: { active: boolean; code: string; name: string; priceCents: number },
) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/additionals/${encodeURIComponent(additionalId)}`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  );
  return readAdditional(response);
}

export async function replaceAdditionalRecipe(
  apiBaseUrl: string,
  additionalId: string,
  recipe: { ingredientId: string; quantity: number }[],
) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/additionals/${encodeURIComponent(additionalId)}/recipe`,
    { body: JSON.stringify({ recipe }), headers: { 'Content-Type': 'application/json' }, method: 'PUT' },
  );
  return readAdditional(response);
}

export async function replaceProductRecipe(
  apiBaseUrl: string,
  productId: string,
  recipe: { ingredientId: string; quantity: number }[],
) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/products/${encodeURIComponent(productId)}/recipe`,
    { body: JSON.stringify({ recipe }), headers: { 'Content-Type': 'application/json' }, method: 'PUT' },
  );
  return readProduct(response);
}

export async function replaceProductAdditionals(
  apiBaseUrl: string,
  productId: string,
  additionalIds: string[],
) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/admin/products/${encodeURIComponent(productId)}/additionals`,
    { body: JSON.stringify({ additionalIds }), headers: { 'Content-Type': 'application/json' }, method: 'PUT' },
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
    Number(product.priceCents) > 0 &&
    typeof product.requiresKitchen === 'boolean' &&
    (product.recipe === undefined ||
      (Array.isArray(product.recipe) && product.recipe.every(isRecipeIngredient))) &&
    (product.additionals === undefined ||
      (Array.isArray(product.additionals) && product.additionals.every(isMenuAdditional)))
  );
}

function isRecipeIngredient(value: unknown): value is RecipeIngredient {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Partial<RecipeIngredient>;
  return Boolean(
    recipe.ingredient &&
      typeof recipe.ingredient.id === 'string' &&
      typeof recipe.ingredient.name === 'string' &&
      Number.isInteger(recipe.quantity),
  );
}

function isRecipeIngredientOption(value: unknown): value is RecipeIngredientOption {
  if (!value || typeof value !== 'object') return false;
  const ingredient = value as Partial<RecipeIngredientOption>;
  return (
    typeof ingredient.id === 'string' &&
    typeof ingredient.name === 'string' &&
    ['UNIT', 'GRAM', 'MILLILITER'].includes(String(ingredient.unit))
  );
}

function isMenuAdditional(value: unknown): value is MenuAdditional {
  if (!value || typeof value !== 'object') return false;
  const additional = value as Partial<MenuAdditional>;
  return (
    typeof additional.active === 'boolean' &&
    typeof additional.code === 'string' &&
    typeof additional.id === 'string' &&
    typeof additional.name === 'string' &&
    Number.isInteger(additional.priceCents) &&
    Array.isArray(additional.recipe) &&
    additional.recipe.every(isRecipeIngredient)
  );
}

async function readAdditional(response: Response) {
  if (!response.ok) throw new Error('Não foi possível salvar o adicional.');
  const payload: unknown = await response.json();
  const additional = objectValue(payload, 'additional');
  if (!isMenuAdditional(additional)) throw new Error('Resposta inválida do adicional.');
  return additional;
}

async function readArray<T>(response: Response, key: string, guard: (value: unknown) => value is T) {
  if (!response.ok) throw new Error('Não foi possível carregar os adicionais.');
  const payload: unknown = await response.json();
  const values = objectValue(payload, key);
  if (!Array.isArray(values) || !values.every(guard)) throw new Error('Resposta inválida.');
  return values;
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
