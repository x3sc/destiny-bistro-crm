import type { PaymentMethod } from "./payment-types.js";

export type DeliveryDayStatus = "OPEN" | "CLOSED";
export type DeliveryOrderStatus =
  | "NEW"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";
export type DeliveryOrderPaymentStatus = "OPEN" | "PAID" | "CREDIT";

export interface DeliveryActor {
  id: string;
  name: string;
}

export interface DeliveryRecord {
  address: string;
  customerName: string;
  deliveredAt: string;
  feeCents: number;
  id: string;
  paymentMethod: PaymentMethod;
  products: string | null;
  recordedBy: DeliveryActor | null;
  totalCents: number;
}

export interface DeliveryExpenseRecord {
  amountCents: number;
  createdAt: string;
  description: string;
  id: string;
  recordedBy: DeliveryActor | null;
}

export interface DeliveryDaySummary {
  closedAt: string | null;
  courierId: string;
  courierName: string;
  dailyRateCents: number;
  deliveryCount: number;
  expensesTotalCents: number;
  feesTotalCents: number;
  id: string;
  openedAt: string;
  payoutCents: number;
  salesTotalCents: number;
  settlementPaidCents: number | null;
  status: DeliveryDayStatus;
}

export interface DeliveryDayDetails extends DeliveryDaySummary {
  deliveries: DeliveryRecord[];
  expenses: DeliveryExpenseRecord[];
}

export interface DeliveryCourierSummary {
  activeDayId: string | null;
  id: string;
  name: string;
  settledTotalCents: number;
}

export interface DeliveryCourierDetails extends DeliveryCourierSummary {
  days: DeliveryDaySummary[];
  periodPayoutCents: number;
  periodSettledCents: number;
}

export interface DeliveryInput {
  address: string;
  customerName: string;
  feeCents: number;
  paymentMethod: PaymentMethod;
  products: string | null;
  totalCents: number;
}

export interface DeliveryExpenseInput {
  amountCents: number;
  description: string;
}

export interface DeliveryPeriod {
  endAt: Date;
  startAt: Date;
}

export interface DeliveryOrderInput {
  address: string;
  customerName: string;
  feeCents: number;
  phone: string;
}

export interface DeliveryOrder {
  address: string;
  comandaId: string;
  comandaNumber: number;
  courierName: string | null;
  createdAt: string;
  customerName: string;
  dayId: string | null;
  deliveredAt: string | null;
  dispatchedAt: string | null;
  feeCents: number;
  hasPendingItems: boolean;
  id: string;
  itemCount: number;
  paidCents: number;
  paymentStatus: DeliveryOrderPaymentStatus;
  phone: string;
  status: DeliveryOrderStatus;
  totalCents: number;
  updatedAt: string;
}

export interface DeliveryRepository {
  addExpense(
    establishmentId: string,
    dayId: string,
    input: DeliveryExpenseInput,
    actorUserId: string,
  ): Promise<DeliveryDayDetails>;
  closeDay(
    establishmentId: string,
    dayId: string,
    actorUserId: string,
  ): Promise<DeliveryDayDetails>;
  createCourier(
    establishmentId: string,
    name: string,
    actorUserId: string,
  ): Promise<DeliveryCourierSummary>;
  createOrder(
    establishmentId: string,
    input: DeliveryOrderInput,
    actorUserId: string,
  ): Promise<DeliveryOrder>;
  advanceOrder(
    establishmentId: string,
    orderId: string,
    status: DeliveryOrderStatus,
    dayId: string | null,
    actorUserId: string,
  ): Promise<DeliveryOrder>;
  findCourier(
    establishmentId: string,
    courierId: string,
    period?: DeliveryPeriod,
  ): Promise<DeliveryCourierDetails>;
  findDay(establishmentId: string, dayId: string): Promise<DeliveryDayDetails>;
  findOrder(establishmentId: string, orderId: string): Promise<DeliveryOrder>;
  listCouriers(establishmentId: string): Promise<DeliveryCourierSummary[]>;
  listOrders(
    establishmentId: string,
    includeDelivered: boolean,
  ): Promise<DeliveryOrder[]>;
  openDay(
    establishmentId: string,
    courierId: string,
    dailyRateCents: number,
    actorUserId: string,
  ): Promise<DeliveryDayDetails>;
  recordDelivery(
    establishmentId: string,
    dayId: string,
    input: DeliveryInput,
    actorUserId: string,
  ): Promise<DeliveryDayDetails>;
}

export class DeliveryCourierNameError extends Error {}
export class DeliveryCourierNotFoundError extends Error {}
export class DeliveryCourierConflictError extends Error {}
export class DeliveryDayNotFoundError extends Error {}
export class DeliveryDayConflictError extends Error {}
export class DeliveryInputError extends Error {}
export class DeliveryOrderNotFoundError extends Error {}
export class DeliveryOrderConflictError extends Error {}

const paymentMethods = new Set<PaymentMethod>([
  "CASH",
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
]);

export function normalizeCourierName(value: unknown) {
  if (typeof value !== "string") {
    throw new DeliveryCourierNameError();
  }

  const name = value.trim().replace(/\s+/gu, " ");

  if (!name || name.length > 80) {
    throw new DeliveryCourierNameError();
  }

  return {
    name,
    normalizedName: name.toLocaleLowerCase("pt-BR"),
  };
}

export function normalizeCents(value: unknown, { allowZero = true } = {}) {
  if (!Number.isSafeInteger(value)) {
    throw new DeliveryInputError();
  }

  const cents = Number(value);

  if (cents < 0 || (!allowZero && cents === 0)) {
    throw new DeliveryInputError();
  }

  return cents;
}

export function normalizeDeliveryInput(value: unknown): DeliveryInput {
  if (!value || typeof value !== "object") {
    throw new DeliveryInputError();
  }

  const {
    address,
    customerName,
    feeCents,
    paymentMethod,
    products,
    totalCents,
  } = value as Record<string, unknown>;

  if (typeof customerName !== "string" || typeof address !== "string") {
    throw new DeliveryInputError();
  }

  const normalizedCustomerName = customerName.trim().replace(/\s+/gu, " ");
  const normalizedAddress = address.trim().replace(/\s+/gu, " ");

  if (
    !normalizedCustomerName ||
    normalizedCustomerName.length > 80 ||
    !normalizedAddress ||
    normalizedAddress.length > 255
  ) {
    throw new DeliveryInputError();
  }

  if (
    typeof paymentMethod !== "string" ||
    !paymentMethods.has(paymentMethod as PaymentMethod)
  ) {
    throw new DeliveryInputError();
  }

  let normalizedProducts: string | null = null;
  if (products !== null && products !== undefined) {
    if (typeof products !== "string") {
      throw new DeliveryInputError();
    }

    const trimmed = products.trim().replace(/\s+/gu, " ");
    if (trimmed.length > 255) {
      throw new DeliveryInputError();
    }

    normalizedProducts = trimmed || null;
  }

  const normalizedFeeCents = normalizeCents(feeCents);
  const normalizedTotalCents = normalizeCents(totalCents, {
    allowZero: false,
  });

  if (normalizedFeeCents > normalizedTotalCents) {
    throw new DeliveryInputError();
  }

  return {
    address: normalizedAddress,
    customerName: normalizedCustomerName,
    feeCents: normalizedFeeCents,
    paymentMethod: paymentMethod as PaymentMethod,
    products: normalizedProducts,
    totalCents: normalizedTotalCents,
  };
}

export function normalizeDeliveryOrderInput(value: unknown): DeliveryOrderInput {
  if (!value || typeof value !== "object") {
    throw new DeliveryInputError();
  }

  const { address, customerName, feeCents, phone } = value as Record<
    string,
    unknown
  >;

  return {
    address: normalizeRequiredText(address, 255),
    customerName: normalizeRequiredText(customerName, 80),
    feeCents: normalizeCents(feeCents),
    phone: normalizeBrazilianMobilePhone(phone),
  };
}

function normalizeBrazilianMobilePhone(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[\d\s()+-]+$/u.test(value)
  ) {
    throw new DeliveryInputError();
  }

  const digits = value.replace(/\D/gu, "");
  if (!/^[1-9]\d9\d{8}$/u.test(digits)) {
    throw new DeliveryInputError();
  }

  return digits;
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    throw new DeliveryInputError();
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength) {
    throw new DeliveryInputError();
  }

  return normalized;
}

export function normalizeExpenseInput(value: unknown): DeliveryExpenseInput {
  if (!value || typeof value !== "object") {
    throw new DeliveryInputError();
  }

  const { amountCents, description } = value as Record<string, unknown>;

  if (typeof description !== "string") {
    throw new DeliveryInputError();
  }

  const normalizedDescription = description.trim().replace(/\s+/gu, " ");

  if (!normalizedDescription || normalizedDescription.length > 255) {
    throw new DeliveryInputError();
  }

  return {
    amountCents: normalizeCents(amountCents, { allowZero: false }),
    description: normalizedDescription,
  };
}

export function calculateDayPayoutCents({
  dailyRateCents,
  expensesTotalCents,
  feesTotalCents,
}: {
  dailyRateCents: number;
  expensesTotalCents: number;
  feesTotalCents: number;
}) {
  return dailyRateCents + feesTotalCents - expensesTotalCents;
}
