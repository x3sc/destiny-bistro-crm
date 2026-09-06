import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export const kitchenTicketStatuses = [
  'PENDING',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
] as const;

export type KitchenTicketStatus = (typeof kitchenTicketStatuses)[number];

export interface KitchenTicketItemAdditional {
  additionalId: string;
  additionalName: string;
  id: string;
  quantityPerUnit: number;
}

export interface KitchenTicketItemConfiguration {
  additionals: KitchenTicketItemAdditional[];
  configurationKey: string;
  id: string;
  quantity: number;
}

export interface KitchenTicketItem {
  comandaItemId: string;
  configurations: KitchenTicketItemConfiguration[];
  id: string;
  productId: string;
  productName: string;
  quantity: number;
}

export interface KitchenTicket {
  comandaId: string;
  comandaNumber: number;
  createdAt: string;
  id: string;
  items: KitchenTicketItem[];
  status: KitchenTicketStatus;
  table: { id: number; number: number } | null;
  updatedAt: string;
}

export async function loadKitchenTickets(apiBaseUrl: string) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/kitchen/tickets`,
  );
  if (!response.ok) {
    throw new Error('Kitchen tickets request failed');
  }
  const payload: unknown = await response.json();
  const tickets = (payload as { tickets?: unknown }).tickets;
  if (!Array.isArray(tickets) || !tickets.every(isKitchenTicket)) {
    throw new Error('Invalid kitchen tickets response');
  }
  return tickets;
}

export async function loadKitchenTicket(
  apiBaseUrl: string,
  ticketId: string,
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/kitchen/tickets/${encodeURIComponent(ticketId)}`,
  );
  return readTicket(response);
}

export async function updateKitchenTicketStatus(
  apiBaseUrl: string,
  ticketId: string,
  status: KitchenTicketStatus,
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/kitchen/tickets/${encodeURIComponent(ticketId)}/status`,
    {
      body: JSON.stringify({ status }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  );
  return readTicket(response);
}

async function readTicket(response: Response) {
  if (!response.ok) {
    throw new Error('Kitchen ticket request failed');
  }
  const payload: unknown = await response.json();
  const ticket = (payload as { ticket?: unknown }).ticket;
  if (!isKitchenTicket(ticket)) {
    throw new Error('Invalid kitchen ticket response');
  }
  return ticket;
}

function requireApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    throw new Error('Missing API URL');
  }
  return normalized;
}

function isKitchenTicket(value: unknown): value is KitchenTicket {
  if (!value || typeof value !== 'object') return false;
  const ticket = value as Partial<KitchenTicket>;
  return (
    typeof ticket.comandaId === 'string' &&
    Number.isInteger(ticket.comandaNumber) &&
    typeof ticket.createdAt === 'string' &&
    typeof ticket.id === 'string' &&
    Array.isArray(ticket.items) &&
    ticket.items.every(isKitchenTicketItem) &&
    kitchenTicketStatuses.includes(ticket.status as KitchenTicketStatus) &&
    (ticket.table === null ||
      (!!ticket.table &&
        typeof ticket.table === 'object' &&
        Number.isInteger(ticket.table.id) &&
        Number.isInteger(ticket.table.number))) &&
    typeof ticket.updatedAt === 'string'
  );
}

function isKitchenTicketItem(value: unknown): value is KitchenTicketItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<KitchenTicketItem>;
  return (
    typeof item.comandaItemId === 'string' &&
    Array.isArray(item.configurations) &&
    item.configurations.every(isKitchenTicketItemConfiguration) &&
    typeof item.id === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0
  );
}

function isKitchenTicketItemConfiguration(
  value: unknown,
): value is KitchenTicketItemConfiguration {
  if (!value || typeof value !== 'object') return false;
  const configuration = value as Partial<KitchenTicketItemConfiguration>;
  return (
    Array.isArray(configuration.additionals) &&
    configuration.additionals.every(isKitchenTicketItemAdditional) &&
    typeof configuration.configurationKey === 'string' &&
    typeof configuration.id === 'string' &&
    Number.isInteger(configuration.quantity) &&
    Number(configuration.quantity) > 0
  );
}

function isKitchenTicketItemAdditional(
  value: unknown,
): value is KitchenTicketItemAdditional {
  if (!value || typeof value !== 'object') return false;
  const additional = value as Partial<KitchenTicketItemAdditional>;
  return (
    typeof additional.additionalId === 'string' &&
    typeof additional.additionalName === 'string' &&
    typeof additional.id === 'string' &&
    Number.isInteger(additional.quantityPerUnit) &&
    Number(additional.quantityPerUnit) > 0
  );
}
