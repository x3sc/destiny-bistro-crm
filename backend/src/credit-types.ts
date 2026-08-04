import type { Payment, PaymentAllocationInput } from "./payment-types.js";

export type CreditOrderSource = "MANUAL" | "TABLE";
export type CreditOrderStatus = "DRAFT" | "OPEN" | "SETTLED" | "CANCELLED";

export interface CreditOrder {
  balanceCents: number;
  cancelledAt: string | null;
  comandaId: string;
  comandaName: string | null;
  comandaNumber: number;
  customerId: string;
  customerName: string;
  finalizedAt: string | null;
  hasPendingItems: boolean;
  id: string;
  orderedAt: string;
  paidCents: number;
  payments: Payment[];
  settledAt: string | null;
  source: CreditOrderSource;
  status: CreditOrderStatus;
  tableNumber: number | null;
  totalCents: number;
}

export interface CreditCustomerSummary {
  balanceCents: number;
  draftOrderCount: number;
  id: string;
  name: string;
  openOrderCount: number;
}

export interface CreditCustomerDetails extends CreditCustomerSummary {
  orders: CreditOrder[];
}

export interface CreditPaymentResult {
  order: CreditOrder;
  payment: Payment;
}

export interface CreditRepository {
  cancelOrder(
    establishmentId: string,
    orderId: string,
    actorUserId: string,
  ): Promise<CreditOrder>;
  convertComanda(
    establishmentId: string,
    comandaId: string,
    customerId: string,
    actorUserId: string,
  ): Promise<CreditOrder>;
  createCustomer(
    establishmentId: string,
    name: string,
    actorUserId: string,
  ): Promise<CreditCustomerSummary>;
  createOrder(
    establishmentId: string,
    customerId: string,
    actorUserId: string,
  ): Promise<CreditOrder>;
  finalizeOrder(
    establishmentId: string,
    orderId: string,
    actorUserId: string,
  ): Promise<CreditOrder>;
  findCustomer(
    establishmentId: string,
    customerId: string,
  ): Promise<CreditCustomerDetails>;
  listCustomers(
    establishmentId: string,
    includeInactive?: boolean,
  ): Promise<CreditCustomerSummary[]>;
  settleOrder(
    establishmentId: string,
    orderId: string,
    payments: PaymentAllocationInput[],
    actorUserId: string,
  ): Promise<CreditPaymentResult>;
}

export class CreditCustomerNotFoundError extends Error {}
export class CreditCustomerNameError extends Error {}
export class CreditOrderNotFoundError extends Error {}
export class CreditOrderConflictError extends Error {}
export class CreditSettlementConflictError extends Error {}
