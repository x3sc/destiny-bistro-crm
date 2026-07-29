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
  addItem(
    establishmentId: string,
    comandaId: string,
    productId: string,
    actorUserId: string,
  ): Promise<Comanda>;
  cancel(establishmentId: string, id: string, actorUserId: string): Promise<Comanda>;
  changeItemQuantity(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    delta: 1 | -1,
    actorUserId: string,
  ): Promise<Comanda>;
  close(establishmentId: string, id: string, actorUserId: string): Promise<Comanda>;
  confirmItem(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    actorUserId: string,
  ): Promise<Comanda>;
  findById(establishmentId: string, id: string): Promise<Comanda>;
  openForTable(
    establishmentId: string,
    tableId: number,
    name: string | null,
    actorUserId: string,
  ): Promise<Comanda>;
  removeItem(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    actorUserId: string,
  ): Promise<Comanda>;
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
