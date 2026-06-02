import { normalizeApiBaseUrl } from './api-base-url';

export type ComandaStatus = 'OPEN' | 'CANCELLED';
export type ComandaEventType = 'OPENED' | 'CANCELLED';
export type ComandaCancellationReason = 'OPENED_BY_MISTAKE';

export interface Comanda {
  cancellationReason: ComandaCancellationReason | null;
  cancelledAt: string | null;
  events: {
    createdAt: string;
    reason: ComandaCancellationReason | null;
    type: ComandaEventType;
  }[];
  id: string;
  number: number;
  openedAt: string;
  status: ComandaStatus;
  table: {
    id: number;
    number: number;
  };
}

function isComandaEvent(value: unknown): value is Comanda['events'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<Comanda['events'][number]>;

  return (
    typeof event.createdAt === 'string' &&
    (event.reason === null || event.reason === 'OPENED_BY_MISTAKE') &&
    (event.type === 'OPENED' || event.type === 'CANCELLED')
  );
}

function isComanda(value: unknown): value is Comanda {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const comanda = value as Partial<Comanda>;

  return (
    typeof comanda.id === 'string' &&
    Number.isInteger(comanda.number) &&
    typeof comanda.openedAt === 'string' &&
    (comanda.cancelledAt === null || typeof comanda.cancelledAt === 'string') &&
    (comanda.cancellationReason === null ||
      comanda.cancellationReason === 'OPENED_BY_MISTAKE') &&
    (comanda.status === 'OPEN' || comanda.status === 'CANCELLED') &&
    !!comanda.table &&
    Number.isInteger(comanda.table.id) &&
    Number.isInteger(comanda.table.number) &&
    Array.isArray(comanda.events) &&
    comanda.events.every(isComandaEvent)
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

export async function openComanda(apiBaseUrl: string, tableId: number) {
  if (!Number.isInteger(tableId) || tableId <= 0) {
    throw new Error('Invalid table id');
  }

  return readComanda(
    await fetch(`${requireApiBaseUrl(apiBaseUrl)}/tables/${tableId}/comandas`, {
      method: 'POST',
    }),
  );
}

export async function loadComanda(apiBaseUrl: string, comandaId: string) {
  return readComanda(
    await fetch(`${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}`),
  );
}

export async function cancelComanda(apiBaseUrl: string, comandaId: string) {
  return readComanda(
    await fetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/cancel`,
      {
        method: 'POST',
      },
    ),
  );
}
