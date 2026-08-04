import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export type StatementOrigin = 'TABLE' | 'CREDIT_MANUAL' | 'CREDIT_TABLE';
export type StatementView = 'detailed' | 'summary';
export type StatementMovementType =
  | 'ALL'
  | 'SALES'
  | 'RECEIPTS'
  | 'CANCELLATIONS';
export type StatementOriginFilter = StatementOrigin | 'ALL';
export interface StatementEntryFilters {
  movementType: StatementMovementType;
  origin: StatementOriginFilter;
}
export const defaultStatementEntryFilters: StatementEntryFilters = {
  movementType: 'ALL',
  origin: 'ALL',
};
export type StatementPaymentSummaryMethod =
  | 'CASH'
  | 'PIX'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'UNSPECIFIED';
export type StatementPaymentOrigin = 'TABLE_CHECKOUT' | 'CREDIT_INSTALLMENT';
export type StatementEvent =
  | 'TABLE_CLOSED'
  | 'CREDIT_FINALIZED'
  | 'CREDIT_ADDITION'
  | 'CREDIT_PAYMENT'
  | 'CREDIT_SETTLED'
  | 'COMANDA_CANCELLED';

export interface StatementSummary {
  cancelledCommandCount: number;
  closedCommandCount: number;
  processedCommandCount: number;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
}

export interface StatementDay extends StatementSummary {
  date: string;
}

export interface StatementEntry {
  comandaId: string;
  comandaName: string | null;
  comandaNumber: number;
  creditBalanceAfterCents: number | null;
  creditPaidAfterCents: number | null;
  creditPaidBeforeCents: number | null;
  creditTotalCents: number | null;
  customerName: string | null;
  event: StatementEvent;
  id: string;
  items: StatementEntryItem[];
  occurredAt: string;
  origin: StatementOrigin;
  payments: {
    amountCents: number;
    method: 'CASH' | 'PIX' | 'DEBIT_CARD' | 'CREDIT_CARD';
  }[];
  paymentOrigin: StatementPaymentOrigin | null;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  tableNumber: number | null;
  tableCheckoutPaidCents: number | null;
}

export interface StatementEntryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface StatementOriginSummary {
  movementCount: number;
  origin: StatementOrigin;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
}

export interface StatementIndicators {
  averageTicketCents: number;
  differenceCents: number;
  originSummaries: StatementOriginSummary[];
  paymentMethodSummaries: {
    method: StatementPaymentSummaryMethod;
    receivedCents: number;
  }[];
  saleCommandCount: number;
}

export interface StatementReport {
  days: StatementDay[];
  entries: StatementEntry[];
  indicators: StatementIndicators;
  period: {
    from: string;
    timeZone: 'America/Sao_Paulo';
    to: string;
  };
  summary: StatementSummary;
}

export async function loadStatement(
  apiBaseUrl: string,
  from: string,
  to: string,
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/statements?${periodQuery(from, to)}`,
  );

  if (!response.ok) {
    throw new Error('Não foi possível carregar o extrato.');
  }

  const payload: unknown = await response.json();
  const statement =
    payload && typeof payload === 'object'
      ? (payload as { statement?: unknown }).statement
      : undefined;

  if (!isStatementReport(statement)) {
    throw new Error('Resposta inválida da API de extratos.');
  }

  return statement;
}

export function statementPdfUrl(
  apiBaseUrl: string,
  from: string,
  to: string,
  view: StatementView,
  filters: StatementEntryFilters = defaultStatementEntryFilters,
) {
  const values: Record<string, string> = { from, to, view };
  if (view === 'detailed' && filters.movementType !== 'ALL') {
    values.movementType = filters.movementType;
  }
  if (view === 'detailed' && filters.origin !== 'ALL') {
    values.origin = filters.origin;
  }
  const query = new URLSearchParams(values).toString();
  return `${requireApiBaseUrl(apiBaseUrl)}/statements/export.pdf?${query}`;
}

function periodQuery(from: string, to: string) {
  return new URLSearchParams({ from, to }).toString();
}

function requireApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    throw new Error('URL da API não configurada.');
  }
  return normalized;
}

function isStatementReport(value: unknown): value is StatementReport {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const report = value as Partial<StatementReport>;
  return (
    isSummary(report.summary) &&
    Array.isArray(report.days) &&
    report.days.every(isDay) &&
    Array.isArray(report.entries) &&
    report.entries.every(isEntry) &&
    isIndicators(report.indicators) &&
    report.indicators.paymentMethodSummaries.reduce(
      (total, payment) => total + payment.receivedCents,
      0,
    ) === report.summary.receivedCents &&
    Boolean(report.period) &&
    typeof report.period?.from === 'string' &&
    typeof report.period?.to === 'string' &&
    report.period?.timeZone === 'America/Sao_Paulo'
  );
}

function isSummary(value: unknown): value is StatementSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const summary = value as Partial<StatementSummary>;
  return [
    summary.cancelledCommandCount,
    summary.closedCommandCount,
    summary.processedCommandCount,
    summary.receivedCents,
    summary.receivedItemCount,
    summary.soldCents,
    summary.soldItemCount,
  ].every(isNonNegativeInteger);
}

function isDay(value: unknown): value is StatementDay {
  return (
    isSummary(value) &&
    typeof (value as Partial<StatementDay>).date === 'string'
  );
}

function isEntry(value: unknown): value is StatementEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<StatementEntry>;
  return (
    typeof entry.comandaId === 'string' &&
    (entry.comandaName === null || typeof entry.comandaName === 'string') &&
    isNonNegativeInteger(entry.comandaNumber) &&
    (entry.creditBalanceAfterCents === null ||
      isNonNegativeInteger(entry.creditBalanceAfterCents)) &&
    (entry.creditPaidAfterCents === null ||
      isNonNegativeInteger(entry.creditPaidAfterCents)) &&
    (entry.creditPaidBeforeCents === null ||
      isNonNegativeInteger(entry.creditPaidBeforeCents)) &&
    (entry.creditTotalCents === null ||
      isNonNegativeInteger(entry.creditTotalCents)) &&
    (entry.customerName === null || typeof entry.customerName === 'string') &&
    isStatementEvent(entry.event) &&
    typeof entry.id === 'string' &&
    Array.isArray(entry.items) &&
    entry.items.every(isEntryItem) &&
    typeof entry.occurredAt === 'string' &&
    isStatementOrigin(entry.origin) &&
    Array.isArray(entry.payments) &&
    entry.payments.every(
      (payment) =>
        isNonNegativeInteger(payment.amountCents) &&
        (payment.method === 'CASH' ||
          payment.method === 'PIX' ||
          payment.method === 'DEBIT_CARD' ||
          payment.method === 'CREDIT_CARD'),
    ) &&
    (entry.paymentOrigin === null ||
      entry.paymentOrigin === 'TABLE_CHECKOUT' ||
      entry.paymentOrigin === 'CREDIT_INSTALLMENT') &&
    isNonNegativeInteger(entry.receivedCents) &&
    isNonNegativeInteger(entry.receivedItemCount) &&
    isNonNegativeInteger(entry.soldCents) &&
    isNonNegativeInteger(entry.soldItemCount) &&
    (entry.status === 'OPEN' ||
      entry.status === 'CLOSED' ||
      entry.status === 'CANCELLED') &&
    (entry.tableNumber === null || isNonNegativeInteger(entry.tableNumber)) &&
    (entry.tableCheckoutPaidCents === null ||
      isNonNegativeInteger(entry.tableCheckoutPaidCents))
  );
}

function isEntryItem(value: unknown): value is StatementEntryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<StatementEntryItem>;
  return (
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    isNonNegativeInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    isNonNegativeInteger(item.unitPriceCents)
  );
}

function isIndicators(value: unknown): value is StatementIndicators {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const indicators = value as Partial<StatementIndicators>;
  return (
    isNonNegativeInteger(indicators.averageTicketCents) &&
    Number.isInteger(indicators.differenceCents) &&
    Array.isArray(indicators.originSummaries) &&
    indicators.originSummaries.every(isOriginSummary) &&
    isPaymentMethodSummaries(indicators.paymentMethodSummaries) &&
    isNonNegativeInteger(indicators.saleCommandCount)
  );
}

function isPaymentMethodSummaries(
  value: unknown,
): value is StatementIndicators['paymentMethodSummaries'] {
  if (!Array.isArray(value) || value.length !== 5) {
    return false;
  }
  const methods = new Set<StatementPaymentSummaryMethod>();
  for (const summary of value) {
    if (
      !summary ||
      typeof summary !== 'object' ||
      !isPaymentSummaryMethod(summary.method) ||
      !isNonNegativeInteger(summary.receivedCents) ||
      methods.has(summary.method)
    ) {
      return false;
    }
    methods.add(summary.method);
  }
  return ['CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'UNSPECIFIED'].every(
    (method) => methods.has(method as StatementPaymentSummaryMethod),
  );
}

function isPaymentSummaryMethod(
  value: unknown,
): value is StatementPaymentSummaryMethod {
  return (
    value === 'CASH' ||
    value === 'PIX' ||
    value === 'DEBIT_CARD' ||
    value === 'CREDIT_CARD' ||
    value === 'UNSPECIFIED'
  );
}

function isOriginSummary(value: unknown): value is StatementOriginSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const summary = value as Partial<StatementOriginSummary>;
  return (
    isStatementOrigin(summary.origin) &&
    [
      summary.movementCount,
      summary.receivedCents,
      summary.receivedItemCount,
      summary.soldCents,
      summary.soldItemCount,
    ].every(isNonNegativeInteger)
  );
}

function isStatementEvent(value: unknown): value is StatementEvent {
  return (
    value === 'TABLE_CLOSED' ||
    value === 'CREDIT_FINALIZED' ||
    value === 'CREDIT_ADDITION' ||
    value === 'CREDIT_PAYMENT' ||
    value === 'CREDIT_SETTLED' ||
    value === 'COMANDA_CANCELLED'
  );
}

function isStatementOrigin(value: unknown): value is StatementOrigin {
  return (
    value === 'TABLE' ||
    value === 'CREDIT_MANUAL' ||
    value === 'CREDIT_TABLE'
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}
