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
  | 'ITEM_REMOVED'
  | 'ITEM_CANCELLED'
  | 'ADDITIONALS_CHANGED';
export type ComandaCancellationReason = 'OPENED_BY_MISTAKE' | 'OPERATOR_CANCELLED';
export type CreditOrderSource = 'MANUAL' | 'TABLE' | 'DELIVERY';
export type CreditOrderStatus = 'DRAFT' | 'OPEN' | 'SETTLED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD';
export type PaymentOrigin =
  | 'TABLE_CHECKOUT'
  | 'CREDIT_INSTALLMENT'
  | 'DELIVERY_CHECKOUT';

export interface PaymentAllocationInput {
  amountCents: number;
  method: PaymentMethod;
}

export interface Payment {
  allocations: (PaymentAllocationInput & { id: string })[];
  amountCents: number;
  comandaId: string;
  creditOrderId: string | null;
  id: string;
  origin: PaymentOrigin;
  paidAt: string;
  recordedBy: { id: string; name: string } | null;
}

export interface ComandaCreditSummary {
  balanceCents: number;
  customerId: string;
  customerName: string;
  orderId: string;
  paidCents: number;
  source: CreditOrderSource;
  status: CreditOrderStatus;
  totalCents: number;
}

export interface ComandaItem {
  additionalTotalCents?: number;
  confirmedQuantity: number;
  configurations?: ComandaItemConfiguration[];
  createdAt: string;
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  subtotalCents: number;
  unitPriceCents: number;
}

export interface ComandaItemConfiguration {
    additionals: {
      additionalId: string;
      additionalName: string;
      id: string;
      quantityPerUnit: number;
      unitPriceCents: number;
    }[];
    configurationKey: string;
    confirmedQuantity: number;
    id: string;
    quantity: number;
    subtotalCents: number;
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
  inventoryWarnings?: InventoryWarning[];
  items: ComandaItem[];
  name: string | null;
  number: number;
  openedAt: string;
  payments: Payment[];
  status: ComandaStatus;
  table: {
    id: number;
    number: number;
  } | null;
  totalCents: number;
}

export interface InventoryWarning {
  availableQuantity?: number;
  ingredientName?: string;
  missingQuantity?: number;
  productName?: string;
  type: 'INSUFFICIENT_STOCK' | 'MISSING_RECIPE';
  unit?: 'UNIT' | 'GRAM' | 'MILLILITER';
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
    (event.reason === null ||
      event.reason === 'OPENED_BY_MISTAKE' ||
      event.reason === 'OPERATOR_CANCELLED') &&
    (event.type === 'OPENED' ||
      event.type === 'CANCELLED' ||
      event.type === 'CLOSED' ||
      event.type === 'ITEM_ADDED' ||
      event.type === 'ITEM_CONFIRMED' ||
      event.type === 'ITEM_QUANTITY_CHANGED' ||
      event.type === 'ITEM_REMOVED' ||
      event.type === 'ITEM_CANCELLED' ||
      event.type === 'ADDITIONALS_CHANGED') &&
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
    Number.isInteger(credit.balanceCents) &&
    typeof credit.customerId === 'string' &&
    typeof credit.customerName === 'string' &&
    typeof credit.orderId === 'string' &&
    Number.isInteger(credit.paidCents) &&
    (credit.source === 'MANUAL' ||
      credit.source === 'TABLE' ||
      credit.source === 'DELIVERY') &&
    (credit.status === 'DRAFT' ||
      credit.status === 'OPEN' ||
      credit.status === 'SETTLED' ||
      credit.status === 'CANCELLED') &&
    Number.isInteger(credit.totalCents)
  );
}

function isPayment(value: unknown): value is Payment {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payment = value as Partial<Payment>;
  return (
    Array.isArray(payment.allocations) &&
    payment.allocations.every(
      (allocation) =>
        typeof allocation.id === 'string' &&
        Number.isInteger(allocation.amountCents) &&
        allocation.amountCents > 0 &&
        isPaymentMethod(allocation.method),
    ) &&
    Number.isInteger(payment.amountCents) &&
    typeof payment.comandaId === 'string' &&
    (payment.creditOrderId === null || typeof payment.creditOrderId === 'string') &&
    typeof payment.id === 'string' &&
    (payment.origin === 'TABLE_CHECKOUT' ||
      payment.origin === 'CREDIT_INSTALLMENT' ||
      payment.origin === 'DELIVERY_CHECKOUT') &&
    typeof payment.paidAt === 'string' &&
    (payment.recordedBy === null ||
      (typeof payment.recordedBy?.id === 'string' &&
        typeof payment.recordedBy?.name === 'string'))
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    value === 'CASH' ||
    value === 'PIX' ||
    value === 'DEBIT_CARD' ||
    value === 'CREDIT_CARD'
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
    Array.isArray(comanda.payments) &&
    comanda.payments.every(isPayment) &&
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

export async function cancelComanda(
  apiBaseUrl: string,
  comandaId: string,
  input?: {
    disposition: 'RETURN_TO_STOCK' | 'LOSS';
    reason: string;
    requestId: string;
  },
) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/cancel`,
      jsonMutationInit('POST', input),
    ),
  );
}

export async function closeComanda(
  apiBaseUrl: string,
  comandaId: string,
  payments: PaymentAllocationInput[],
  customerId?: string,
) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/close`,
      jsonMutationInit('POST', {
        payments,
        ...(customerId ? { customerId } : {}),
      }),
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
): Promise<Comanda> {
  const response = await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}/confirm`,
      jsonMutationInit('POST'),
    );
  if (!response.ok) throw new Error('Comanda request failed');
  const payload: unknown = await response.json();
  const candidate = payload as { comanda?: unknown; inventoryWarnings?: unknown };
  if (
    !isComanda(candidate.comanda) ||
    (candidate.inventoryWarnings !== undefined &&
      !isInventoryWarnings(candidate.inventoryWarnings))
  ) {
    throw new Error('Invalid comanda response');
  }
  return candidate.inventoryWarnings === undefined
    ? candidate.comanda
    : { ...candidate.comanda, inventoryWarnings: candidate.inventoryWarnings };
}

export async function configureComandaItemAdditionals(
  apiBaseUrl: string,
  comandaId: string,
  itemId: string,
  input: {
    additionals: { additionalId: string; quantityPerUnit: number }[];
    quantity: number;
    requestId: string;
  },
) {
  return readComanda(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}/additionals`,
      { ...jsonMutationInit('POST', input), method: 'PUT' },
    ),
  );
}

export async function cancelComandaItemConfiguration(
  apiBaseUrl: string,
  comandaId: string,
  itemId: string,
  configurationId: string,
  input: {
    disposition: 'RETURN_TO_STOCK' | 'LOSS';
    quantity: number;
    reason: string;
    requestId: string;
  },
): Promise<Comanda> {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/items/${encodeURIComponent(itemId)}/configurations/${encodeURIComponent(configurationId)}/cancel`,
    jsonMutationInit('POST', input),
  );
  if (!response.ok) throw new Error('Comanda request failed');
  const payload: unknown = await response.json();
  const candidate = payload as { comanda?: unknown; inventoryWarnings?: unknown };
  if (!isComanda(candidate.comanda)) throw new Error('Invalid comanda response');
  return {
    ...candidate.comanda,
    ...(isInventoryWarnings(candidate.inventoryWarnings)
      ? { inventoryWarnings: candidate.inventoryWarnings }
      : {}),
  };
}

function isInventoryWarnings(value: unknown): value is InventoryWarning[] {
  return Array.isArray(value) && value.every((warning) => {
    if (!warning || typeof warning !== 'object') return false;
    const candidate = warning as Partial<InventoryWarning>;
    return candidate.type === 'INSUFFICIENT_STOCK' || candidate.type === 'MISSING_RECIPE';
  });
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
