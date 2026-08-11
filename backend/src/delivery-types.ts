import type { PaymentMethod } from "./payment-types.js";

export type DeliveryDayStatus = "OPEN" | "CLOSED";

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
  findCourier(
    establishmentId: string,
    courierId: string,
    period?: DeliveryPeriod,
  ): Promise<DeliveryCourierDetails>;
  findDay(establishmentId: string, dayId: string): Promise<DeliveryDayDetails>;
  listCouriers(establishmentId: string): Promise<DeliveryCourierSummary[]>;
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

  return {
    address: normalizedAddress,
    customerName: normalizedCustomerName,
    feeCents: normalizeCents(feeCents),
    paymentMethod: paymentMethod as PaymentMethod,
    products: normalizedProducts,
    totalCents: normalizeCents(totalCents, { allowZero: false }),
  };
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
