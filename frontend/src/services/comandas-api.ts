import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export type ComandaStatus = 'OPEN' | 'CANCELLED' | 'CLOSED';
export type ComandaEventType =
  | 'OPENED'
  | 'CANCELLED'
  | 'CLOSED'
  | 'ITEM_ADDED'
  | 'ITEM_CONFIRMED'
  | 'ITEM_QUANTITY_CHANGED'
  | 'ITEM_REMOVED';
export type ComandaCancellationReason = 'OPENED_BY_MISTAKE';
export type CreditOrderSource = 'MANUAL' | 'TABLE';
export type CreditOrderStatus = 'DRAFT' | 'OPEN' | 'SETTLED' | 'CANCELLED';

export interface ComandaCreditSummary {
  customerId: string;
  customerName: string;
  orderId: string;
  source: CreditOrderSource;
  status: CreditOrderStatus;
}

export interface ComandaItem {
  confirmedQuantity: number;
  createdAt: string;
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  subtotalCents: number;
  unitPriceCents: number;
}

export interface Comanda {
  cancellationReason: ComandaCancellationReason | null;
  cancelledAt: string | null;
  closedAt: string | null;
  credit: ComandaCreditSummary | null;
  events: {
    actor: {
      id: string;
      name: string;
    } | null;
    createdAt: string;
    itemId: string | null;
    newQuantity: number | null;
    previousQuantity: number | null;
    productId: string | null;
    productName: string | null;
    reason: ComandaCancellationReason | null;
    type: ComandaEventType;
    unitPriceCents: number | null;
  }[];
  id: string;
  items: ComandaItem[];
  name: string | null;
  number: number;
  openedAt: string;
  status: ComandaStatus;
  table: {
    id: number;
    number: number;
  } | null;
  totalCents: number;
}

function isComandaEvent(value: unknown): value is Comanda['events'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<Comanda['events'][number]>;

  return (
    (event.actor === null ||
      (!!event.actor &&
        typeof event.actor === 'object' &&
        typeof event.actor.id === 'string' &&
        typeof event.actor.name === 'string')) &&
    typeof event.createdAt === 'string' &&
    (event.itemId === null || typeof event.itemId === 'string') &&
    (event.newQuantity === null || Number.isInteger(event.newQuantity)) &&
    (event.previousQuantity === null || Number.isInteger(event.previousQuantity)) &&
    (event.productId === null || typeof event.productId === 'string') &&
    (event.productName === null || typeof event.productName === 'string') &&
    (event.reason === null || event.reason === 'OPENED_BY_MISTAKE') &&
    (event.type === 'OPENED' ||
      event.type === 'CANCELLED' ||
      event.type === 'CLOSED' ||
      event.type === 'ITEM_ADDED' ||
      event.type === 'ITEM_CONFIRMED' ||
      event.type === 'ITEM_QUANTITY_CHANGED' ||
      event.type === 'ITEM_REMOVED') &&
    (event.unitPriceCents === null || Number.isInteger(event.unitPriceCents))
  );
}

function isComandaItem(value: unknown): value is ComandaItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<ComandaItem>;

  return (
    Number.isInteger(item.confirmedQuantity) &&
    (item.confirmedQuantity ?? -1) >= 0 &&
    typeof item.createdAt === 'string' &&
    typeof item.id === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    Number.isInteger(item.quantity) &&
    (item.confirmedQuantity ?? 0) <= (item.quantity ?? -1) &&
    Number.isInteger(item.subtotalCents) &&
    Number.isInteger(item.unitPriceCents)
  );
}

function isComandaCredit(value: unknown): value is ComandaCreditSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const credit = value as Partial<ComandaCreditSummary>;

  return (
    typeof credit.customerId === 'string' &&
    typeof credit.customerName === 'string' &&
    typeof credit.orderId === 'string' &&
    (credit.source === 'MANUAL' || credit.source === 'TABLE') &&
    (credit.status === 'DRAFT' ||
      credit.status === 'OPEN' ||
      credit.status === 'SETTLED' ||
      credit.status === 'CANCELLED')
  );
}

function isComanda(value: unknown): value is Comanda {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const comanda = value as Partial<Comanda>;

  return (
    typeof comanda.id === 'string' &&
    (comanda.name === null || typeof comanda.name === 'string') &&
    Number.isInteger(comanda.number) &&
    typeof comanda.openedAt === 'string' &&
    (comanda.cancelledAt === null || typeof comanda.cancelledAt === 'string') &&
    (comanda.closedAt === null || typeof comanda.closedAt === 'string') &&
    (comanda.cancellationReason === null ||
      comanda.cancellationReason === 'OPENED_BY_MISTAKE') &&
    (comanda.credit === null || isComandaCredit(comanda.credit)) &&
    (comanda.status === 'OPEN' ||
      comanda.status === 'CANCELLED' ||
      comanda.status === 'CLOSED') &&
    (comanda.table === null ||
      (Number.isInteger(comanda.table?.id) &&
        Number.isInteger(comanda.table?.number))) &&
    Array.isArray(comanda.events) &&
    comanda.events.every(isComandaEvent) &&
    Array.isArray(comanda.items) &&
    comanda.items.every(isComandaItem) &&
    Number.isInteger(comanda.totalCents)
  );
}

async function readComanda(response: Response): Promise<Comanda> {
  if (!response.ok) {
    throw new Error('Comanda request failed');
  }

  const payload: unknown = await response.json();

  if (!payload || typeof payload !== 'object' || !isComanda((payload as { comanda?: unknown }).comanda)) {
    throw new Error('Invalid comanda response');
  }

  return (payload as { comanda: Comanda }).comanda;
}

function requireApiBaseUrl(value: string) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(value);

  if (!normalizedApiBaseUrl) {
    throw new Error('Missing API URL');
  }

  return normalizedApiBaseUrl;
}

function jsonMutationInit(method: 'DELETE' | 'PATCH' | 'POST', body: object = {}) {
  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method,
  };
}

export async function openComanda(
  apiBaseUrl: string,
  tableId: number,
  name?: string,
) {
  if (!Number.isInteger(tableId) || tableId <= 0) {
    throw new Error('Invalid table id');
  }

  const normalizedName = name?.trim();

  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/tables/${tableId}/comandas`,
      jsonMutationInit('POST', normalizedName ? { name: normalizedName } : {}),
    ),
  );
}

export async function loadComanda(apiBaseUrl: string, comandaId: string) {
  return readComanda(
    await authenticatedFetch(`${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}`),
  );
}

export async function cancelComanda(apiBaseUrl: string, comandaId: string) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/cancel`,
      jsonMutationInit('POST'),
    ),
  );
}

export async function closeComanda(apiBaseUrl: string, comandaId: string) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/close`,
      jsonMutationInit('POST'),
    ),
  );
}

export async function addComandaItem(
  apiBaseUrl: string,
  comandaId: string,
  productId: string,
) {
  return readComanda(
    await authenticatedFetch(`${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items`, {
      ...jsonMutationInit('POST', { productId }),
    }),
  );
}

export async function changeComandaItemQuantity(
  apiBaseUrl: string,
  comandaId: string,
  itemId: string,
  delta: 1 | -1,
) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}`,
      jsonMutationInit('PATCH', { delta }),
    ),
  );
}

export async function confirmComandaItem(
  apiBaseUrl: string,
  comandaId: string,
  itemId: string,
) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}/confirm`,
      jsonMutationInit('POST'),
    ),
  );
}

export async function removeComandaItem(
  apiBaseUrl: string,
  comandaId: string,
  itemId: string,
) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}`,
      jsonMutationInit('DELETE'),
    ),
  );
}
