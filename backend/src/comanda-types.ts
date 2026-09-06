import type { Payment, PaymentAllocationInput } from "./payment-types.js";
import type {
  ComandaPrintDocument,
  ComandaPrintKind,
} from "./comanda-print-document.js";

export type ComandaStatus = "OPEN" | "CANCELLED" | "CLOSED";
export type ComandaEventType =
  | "OPENED"
  | "CANCELLED"
  | "CLOSED"
  | "ITEM_ADDED"
  | "ITEM_CONFIRMED"
  | "ITEM_QUANTITY_CHANGED"
  | "ITEM_REMOVED"
  | "ITEM_CANCELLED"
  | "ADDITIONALS_CHANGED";
export type ComandaCancellationReason =
  | "OPENED_BY_MISTAKE"
  | "OPERATOR_CANCELLED";

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
  additionalTotalCents: number;
  confirmedQuantity: number;
  configurations: ComandaItemConfiguration[];
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

export interface InventoryWarning {
  availableQuantity?: number;
  ingredientId?: string;
  ingredientName?: string;
  missingQuantity?: number;
  productId?: string;
  productName?: string;
  type: "INSUFFICIENT_STOCK" | "MISSING_RECIPE";
  unit?: "UNIT" | "GRAM" | "MILLILITER";
}

export interface ConfirmItemResult {
  comanda: Comanda;
  inventoryWarnings: InventoryWarning[];
}

export interface Comanda {
  cancellationReason: ComandaCancellationReason | null;
  cancelledAt: string | null;
  closedAt: string | null;
  credit: {
    balanceCents: number;
    customerId: string;
    customerName: string;
    orderId: string;
    paidCents: number;
    source: "MANUAL" | "TABLE" | "DELIVERY";
    status: "DRAFT" | "OPEN" | "SETTLED" | "CANCELLED";
    totalCents: number;
  } | null;
  events: ComandaEvent[];
  id: string;
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

export interface ComandaRepository {
  addItem(
    establishmentId: string,
    comandaId: string,
    productId: string,
    actorUserId: string,
  ): Promise<Comanda>;
  cancel(
    establishmentId: string,
    id: string,
    input: {
      disposition: "RETURN_TO_STOCK" | "LOSS";
      reason: string;
      requestId: string;
    } | null,
    canWriteInventory: boolean,
    actorUserId: string,
  ): Promise<Comanda>;
  changeItemQuantity(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    delta: 1 | -1,
    actorUserId: string,
  ): Promise<Comanda>;
  close(
    establishmentId: string,
    id: string,
    payments: PaymentAllocationInput[],
    customerId: string | null,
    canCreateCredit: boolean,
    actorUserId: string,
  ): Promise<Comanda>;
  confirmItem(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    actorUserId: string,
  ): Promise<ConfirmItemResult>;
  configureItemAdditionals(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    input: {
      additionals: { additionalId: string; quantityPerUnit: number }[];
      quantity: number;
      requestId: string;
    },
    actorUserId: string,
  ): Promise<Comanda>;
  cancelItemConfiguration(
    establishmentId: string,
    comandaId: string,
    itemId: string,
    configurationId: string,
    input: {
      disposition: "RETURN_TO_STOCK" | "LOSS";
      quantity: number;
      reason: string;
      requestId: string;
    },
    actorUserId: string,
  ): Promise<ConfirmItemResult>;
  findById(establishmentId: string, id: string): Promise<Comanda>;
  findPrintDocument(
    establishmentId: string,
    id: string,
    kind: ComandaPrintKind,
    generatedBy: string,
  ): Promise<ComandaPrintDocument>;
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

export { PrintDocumentEmptyError } from "./comanda-print-document.js";

export class TableNotFoundError extends Error {}
export class TableUnavailableError extends Error {}
export class ComandaNotFoundError extends Error {}
export class ComandaNotCancellableError extends Error {}
export class ComandaCancellationConflictError extends Error {}
export class ComandaInventoryPermissionError extends Error {}
export class ComandaNotClosableError extends Error {}
export class ComandaPaymentError extends Error {}
export class ComandaCreditPermissionError extends Error {}
export class ComandaNotMutableError extends Error {}
export class ComandaItemNotFoundError extends Error {}
export class ComandaItemQuantityError extends Error {}
export class ProductUnavailableError extends Error {}
export class AdditionalUnavailableError extends Error {}
export class ComandaItemConfigurationError extends Error {}
