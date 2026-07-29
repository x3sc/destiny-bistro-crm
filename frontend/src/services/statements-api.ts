import { normalizeApiBaseUrl } from './api-base-url';

export type StatementOrigin = 'TABLE' | 'CREDIT_MANUAL' | 'CREDIT_TABLE';
export type StatementEvent =
  | 'TABLE_CLOSED'
  | 'CREDIT_FINALIZED'
  | 'CREDIT_ADDITION'
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
  event: StatementEvent;
  id: string;
  occurredAt: string;
  origin: StatementOrigin;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  tableNumber: number | null;
}

export interface StatementReport {
  days: StatementDay[];
  entries: StatementEntry[];
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
  const response = await fetch(
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
) {
  return `${requireApiBaseUrl(apiBaseUrl)}/statements/export.pdf?${periodQuery(from, to)}`;
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
    isStatementEvent(entry.event) &&
    typeof entry.id === 'string' &&
    typeof entry.occurredAt === 'string' &&
    isStatementOrigin(entry.origin) &&
    isNonNegativeInteger(entry.receivedCents) &&
    isNonNegativeInteger(entry.receivedItemCount) &&
    isNonNegativeInteger(entry.soldCents) &&
    isNonNegativeInteger(entry.soldItemCount) &&
    (entry.status === 'OPEN' ||
      entry.status === 'CLOSED' ||
      entry.status === 'CANCELLED') &&
    (entry.tableNumber === null || isNonNegativeInteger(entry.tableNumber))
  );
}

function isStatementEvent(value: unknown): value is StatementEvent {
  return (
    value === 'TABLE_CLOSED' ||
    value === 'CREDIT_FINALIZED' ||
    value === 'CREDIT_ADDITION' ||
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
