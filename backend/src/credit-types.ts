export type CreditOrderSource = "MANUAL" | "TABLE";
export type CreditOrderStatus = "DRAFT" | "OPEN" | "SETTLED" | "CANCELLED";

export interface CreditOrder {
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
  settledAt: string | null;
  source: CreditOrderSource;
  status: CreditOrderStatus;
  tableNumber: number | null;
  totalCents: number;
}

export interface CreditSettlement {
  amountCents: number;
  id: string;
  orderId: string;
  paidAt: string;
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
  settlements: CreditSettlement[];
}

export interface CreditRepository {
  cancelOrder(orderId: string): Promise<CreditOrder>;
  convertComanda(comandaId: string, customerId: string): Promise<CreditOrder>;
  createCustomer(name: string): Promise<CreditCustomerSummary>;
  createOrder(customerId: string): Promise<CreditOrder>;
  finalizeOrder(orderId: string): Promise<CreditOrder>;
  findCustomer(customerId: string): Promise<CreditCustomerDetails>;
  listCustomers(includeInactive?: boolean): Promise<CreditCustomerSummary[]>;
  settleOrder(orderId: string): Promise<CreditSettlement>;
}

export class CreditCustomerNotFoundError extends Error {}
export class CreditCustomerNameError extends Error {}
export class CreditOrderNotFoundError extends Error {}
export class CreditOrderConflictError extends Error {}
export class CreditSettlementConflictError extends Error {}
