export type ComandaStatus = "OPEN" | "CANCELLED" | "CLOSED";
export type ComandaEventType =
  | "OPENED"
  | "CANCELLED"
  | "CLOSED"
  | "ITEM_ADDED"
  | "ITEM_CONFIRMED"
  | "ITEM_QUANTITY_CHANGED"
  | "ITEM_REMOVED";
export type ComandaCancellationReason = "OPENED_BY_MISTAKE";

export interface ComandaEvent {
  createdAt: string;
  itemId: string | null;
  newQuantity: number | null;
  previousQuantity: number | null;
  productId: string | null;
  productName: string | null;
  reason: ComandaCancellationReason | null;
  type: ComandaEventType;
  unitPriceCents: number | null;
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
  credit: {
    customerId: string;
    customerName: string;
    orderId: string;
    source: "MANUAL" | "TABLE";
    status: "DRAFT" | "OPEN" | "SETTLED" | "CANCELLED";
  } | null;
  events: ComandaEvent[];
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

export interface ComandaRepository {
  addItem(comandaId: string, productId: string): Promise<Comanda>;
  cancel(id: string): Promise<Comanda>;
  changeItemQuantity(comandaId: string, itemId: string, delta: 1 | -1): Promise<Comanda>;
  close(id: string): Promise<Comanda>;
  confirmItem(comandaId: string, itemId: string): Promise<Comanda>;
  findById(id: string): Promise<Comanda>;
  openForTable(tableId: number, name: string | null): Promise<Comanda>;
  removeItem(comandaId: string, itemId: string): Promise<Comanda>;
}

export class TableNotFoundError extends Error {}
export class TableUnavailableError extends Error {}
export class ComandaNotFoundError extends Error {}
export class ComandaNotCancellableError extends Error {}
export class ComandaNotClosableError extends Error {}
export class ComandaNotMutableError extends Error {}
export class ComandaItemNotFoundError extends Error {}
export class ComandaItemQuantityError extends Error {}
export class ProductUnavailableError extends Error {}
