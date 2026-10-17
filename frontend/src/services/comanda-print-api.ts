import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';
import { isServiceFee } from './comandas-api';

export type ComandaPrintKind = 'CONFIRMED' | 'KITCHEN_PENDING' | 'CHECKOUT_PREVIEW' | 'COUNTER_PENDING' | 'COUNTER_FINAL';

export interface ComandaPrintDocument {
  serviceFee?: { included: boolean; percent: number; subtotalCents: number; amountCents: number };
  externalPaymentMethod?: 'COUNTER';
  comandaId: string;
  comandaName: string | null;
  comandaNumber: number;
  deliveryFeeCents: number | null;
  destination: 'QUICK_SALE' | 'COUNTER' | 'DELIVERY' | 'TABLE';
  establishmentName: string;
  generatedAt: string;
  generatedBy: string;
  items: ComandaPrintItem[];
  kind: ComandaPrintKind;
  openedAt: string;
  status: 'OPEN' | 'CANCELLED' | 'CLOSED';
  tableNumber: number | null;
  totalCents: number | null;
}

export interface ComandaPrintItem {
  additionals: {
    name: string;
    quantityPerUnit: number;
    unitPriceCents: number | null;
  }[];
  productName: string;
  quantity: number;
  subtotalCents: number | null;
  unitPriceCents: number | null;
}

export async function loadComandaPrintDocument(
  apiBaseUrl: string,
  comandaId: string,
  kind: ComandaPrintKind,
  preview?: { includeServiceFee: boolean; expectedSnapshot: string },
) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  if (!baseUrl) {
    throw new Error('Endereço da API não configurado.');
  }

  const response = await authenticatedFetch(
    `${baseUrl}/comandas/${encodeURIComponent(comandaId)}/print-document?kind=${kind}${preview ? `&includeServiceFee=${preview.includeServiceFee}&expectedSnapshot=${encodeURIComponent(preview.expectedSnapshot)}` : ''}`,
  );
  if (response.status === 409) {
    if (kind === 'COUNTER_FINAL') throw new PrintAccountConflictError('A comanda mudou ou ainda tem pendências. Recarregue antes de emitir a conferência final.');
    if (kind === 'COUNTER_PENDING') throw new PrintAccountConflictError('Não há pendentes disponíveis para imprimir. Recarregue a comanda.');
    if (kind === 'CHECKOUT_PREVIEW') throw new PrintAccountConflictError('A conta mudou. Recarregue antes de imprimir.');
    throw new Error(
      kind === 'CONFIRMED'
        ? 'Não há itens confirmados para imprimir.'
        : 'Não há itens pendentes de cozinha para imprimir.',
    );
  }
  if (!response.ok) {
    throw new Error('Não foi possível preparar a impressão.');
  }

  const body: unknown = await response.json();
  if (!isPrintResponse(body)) {
    throw new Error('Resposta de impressão inválida.');
  }
  return body.document;
}

function isPrintResponse(value: unknown): value is { document: ComandaPrintDocument } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'document' in value &&
      isPrintDocument(value.document),
  );
}

function isPrintDocument(value: unknown): value is ComandaPrintDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<ComandaPrintDocument>;
  if (document.serviceFee !== undefined && !isServiceFee(document.serviceFee)) return false;
  return (
    typeof document.comandaId === 'string' &&
    (document.externalPaymentMethod === undefined || (document.externalPaymentMethod === 'COUNTER' && document.status === 'CLOSED' && document.destination === 'COUNTER' && document.kind === 'CONFIRMED')) &&
    (document.comandaName === null || typeof document.comandaName === 'string') &&
    Number.isInteger(document.comandaNumber) &&
    (document.deliveryFeeCents === null || Number.isInteger(document.deliveryFeeCents)) &&
    (document.destination === 'QUICK_SALE' ||
      document.destination === 'COUNTER' ||
      document.destination === 'DELIVERY' ||
      document.destination === 'TABLE') &&
    typeof document.establishmentName === 'string' &&
    typeof document.generatedAt === 'string' &&
    typeof document.generatedBy === 'string' &&
    Array.isArray(document.items) &&
    document.items.every(isPrintItem) &&
    (document.kind === 'CONFIRMED' || document.kind === 'KITCHEN_PENDING' || document.kind === 'CHECKOUT_PREVIEW' || document.kind === 'COUNTER_PENDING' || document.kind === 'COUNTER_FINAL') &&
    typeof document.openedAt === 'string' &&
    (document.status === 'OPEN' || document.status === 'CANCELLED' || document.status === 'CLOSED') &&
    (document.tableNumber === null || Number.isInteger(document.tableNumber)) &&
    (document.totalCents === null || Number.isInteger(document.totalCents))
  );
}

export class PrintAccountConflictError extends Error {}

function isPrintItem(value: unknown): value is ComandaPrintItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ComandaPrintItem>;
  return (
    Array.isArray(item.additionals) &&
    item.additionals.every(
      (additional) =>
        typeof additional.name === 'string' &&
        Number.isInteger(additional.quantityPerUnit) &&
        additional.quantityPerUnit > 0 &&
        (additional.unitPriceCents === null || Number.isInteger(additional.unitPriceCents)),
    ) &&
    typeof item.productName === 'string' &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    (item.subtotalCents === null || Number.isInteger(item.subtotalCents)) &&
    (item.unitPriceCents === null || Number.isInteger(item.unitPriceCents))
  );
}
