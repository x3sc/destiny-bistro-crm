import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export type IngredientUnit = 'UNIT' | 'GRAM' | 'MILLILITER';
export type InventoryInputUnit = IngredientUnit | 'KILOGRAM' | 'LITER';

export interface InventoryItem {
  deficitQuantity: number;
  id: string;
  ingredient: {
    active: boolean;
    code: string;
    id: string;
    name: string;
    unit: IngredientUnit;
  };
  lowStock: boolean;
  minimumQuantity: number;
  quantity: number;
  updatedAt: string;
}

export interface InventoryLot {
  code: string | null;
  currentQuantity: number;
  expired: boolean;
  expiresAt: string | null;
  id: string;
  initialQuantity: number;
  origin: 'PURCHASE' | 'ADJUSTMENT' | 'REVERSAL' | 'LEGACY';
  receivedAt: string;
  stockId: string;
  totalCostCents: number | null;
}

export interface InventoryMovement {
  balanceAfter: number;
  balanceBefore: number;
  createdAt: string;
  id: string;
  quantityDelta: number;
  reason: string;
  stockId: string;
  type: string;
}

export async function loadInventory(apiBaseUrl: string) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}/inventory`);
  return readArray<InventoryItem>(response, 'inventory', isInventoryItem);
}

export async function loadInventoryLots(apiBaseUrl: string, stockId: string) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/inventory/${encodeURIComponent(stockId)}/lots`,
  );
  return readArray<InventoryLot>(response, 'lots', isInventoryLot);
}

export async function loadInventoryMovements(apiBaseUrl: string, stockId: string) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/inventory/${encodeURIComponent(stockId)}/movements`,
  );
  return readArray<InventoryMovement>(response, 'movements', isInventoryMovement);
}

export async function createIngredient(
  apiBaseUrl: string,
  input: { code: string; minimumQuantity: number; name: string; unit: IngredientUnit },
) {
  const response = await authenticatedFetch(`${baseUrl(apiBaseUrl)}/ingredients`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  return readObject<InventoryItem>(response, 'inventoryItem', isInventoryItem);
}

export async function createInventoryEntry(
  apiBaseUrl: string,
  stockId: string,
  input: {
    code: string | null;
    expiresAt: string | null;
    quantity: string;
    reason: string;
    receivedAt: string;
    requestId: string;
    totalCostCents: number;
    unit: InventoryInputUnit;
  },
) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/inventory/${encodeURIComponent(stockId)}/entries`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  if (!response.ok) throw new Error('Não foi possível registrar a entrada.');
}

export async function createInventoryMovement(
  apiBaseUrl: string,
  stockId: string,
  input: { quantityDelta: number; reason: string; type: 'EXIT' | 'ADJUSTMENT' },
) {
  const response = await authenticatedFetch(
    `${baseUrl(apiBaseUrl)}/inventory/${encodeURIComponent(stockId)}/movements`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  if (!response.ok) throw new Error('Não foi possível registrar a movimentação.');
}

function baseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) throw new Error('API não configurada.');
  return normalized;
}

async function readArray<T>(
  response: Response,
  field: string,
  guard: (value: unknown) => value is T,
) {
  if (!response.ok) throw new Error('Não foi possível carregar o estoque.');
  const payload: unknown = await response.json();
  const value = objectValue(payload, field);
  if (!Array.isArray(value) || !value.every(guard)) {
    throw new Error('Resposta inválida do estoque.');
  }
  return value;
}

async function readObject<T>(
  response: Response,
  field: string,
  guard: (value: unknown) => value is T,
) {
  if (!response.ok) throw new Error('Não foi possível salvar o insumo.');
  const payload: unknown = await response.json();
  const value = objectValue(payload, field);
  if (!guard(value)) throw new Error('Resposta inválida do estoque.');
  return value;
}

function objectValue(value: unknown, field: string) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)[field]
    : undefined;
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<InventoryItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.minimumQuantity === 'number' &&
    typeof item.deficitQuantity === 'number' &&
    typeof item.lowStock === 'boolean' &&
    Boolean(item.ingredient && typeof item.ingredient.name === 'string')
  );
}

function isInventoryLot(value: unknown): value is InventoryLot {
  if (!value || typeof value !== 'object') return false;
  const lot = value as Partial<InventoryLot>;
  return typeof lot.id === 'string' && typeof lot.currentQuantity === 'number';
}

function isInventoryMovement(value: unknown): value is InventoryMovement {
  if (!value || typeof value !== 'object') return false;
  const movement = value as Partial<InventoryMovement>;
  return typeof movement.id === 'string' && typeof movement.quantityDelta === 'number';
}
