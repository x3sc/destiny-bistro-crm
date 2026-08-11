import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';
import type { PaymentMethod } from './comandas-api';

export type DeliveryDayStatus = 'OPEN' | 'CLOSED';

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

export interface DeliveryDraft {
  address: string;
  customerName: string;
  feeCents: number;
  paymentMethod: PaymentMethod;
  products: string | null;
  totalCents: number;
}

export async function loadDeliveryCouriers(apiBaseUrl: string) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/delivery/couriers`,
  );

  if (!response.ok) {
    throw new Error('Delivery couriers request failed');
  }

  const payload: unknown = await response.json();
  const couriers =
    payload && typeof payload === 'object'
      ? (payload as { couriers?: unknown }).couriers
      : undefined;

  if (!Array.isArray(couriers) || !couriers.every(isCourierSummary)) {
    throw new Error('Invalid delivery couriers response');
  }

  return couriers;
}

export async function createDeliveryCourier(apiBaseUrl: string, name: string) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/delivery/couriers`,
    jsonPost({ name: name.trim() }),
  );

  if (response.status === 409) {
    throw new Error('Já existe um entregador com esse nome.');
  }

  if (!response.ok) {
    throw new Error('Delivery courier request failed');
  }

  const payload: unknown = await response.json();
  const courier =
    payload && typeof payload === 'object'
      ? (payload as { courier?: unknown }).courier
      : undefined;

  if (!isCourierSummary(courier)) {
    throw new Error('Invalid delivery courier response');
  }

  return courier;
}

export async function loadDeliveryCourier(
  apiBaseUrl: string,
  courierId: string,
  period?: { from: string; to: string },
) {
  const query = period
    ? `?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`
    : '';
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/delivery/couriers/${encodeURIComponent(courierId)}${query}`,
  );

  if (!response.ok) {
    throw new Error('Delivery courier request failed');
  }

  const payload: unknown = await response.json();
  const courier =
    payload && typeof payload === 'object'
      ? (payload as { courier?: unknown }).courier
      : undefined;

  if (!isCourierDetails(courier)) {
    throw new Error('Invalid delivery courier response');
  }

  return courier;
}

export async function openDeliveryDay(
  apiBaseUrl: string,
  courierId: string,
  dailyRateCents: number,
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/delivery/couriers/${encodeURIComponent(courierId)}/days`,
    jsonPost({ dailyRateCents }),
  );

  if (response.status === 409) {
    throw new Error('Esse entregador já tem um dia aberto.');
  }

  return readDay(response);
}

export async function loadDeliveryDay(apiBaseUrl: string, dayId: string) {
  return readDay(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/days/${encodeURIComponent(dayId)}`,
    ),
  );
}

export async function recordDelivery(
  apiBaseUrl: string,
  dayId: string,
  draft: DeliveryDraft,
) {
  return readDay(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/days/${encodeURIComponent(dayId)}/deliveries`,
      jsonPost(draft),
    ),
  );
}

export async function recordDeliveryExpense(
  apiBaseUrl: string,
  dayId: string,
  expense: { amountCents: number; description: string },
) {
  return readDay(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/days/${encodeURIComponent(dayId)}/expenses`,
      jsonPost(expense),
    ),
  );
}

export async function closeDeliveryDay(apiBaseUrl: string, dayId: string) {
  return readDay(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/days/${encodeURIComponent(dayId)}/close`,
      jsonPost(),
    ),
  );
}

function isCourierSummary(value: unknown): value is DeliveryCourierSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const courier = value as Partial<DeliveryCourierSummary>;

  return (
    (courier.activeDayId === null || typeof courier.activeDayId === 'string') &&
    typeof courier.id === 'string' &&
    typeof courier.name === 'string' &&
    Number.isInteger(courier.settledTotalCents)
  );
}

function isCourierDetails(value: unknown): value is DeliveryCourierDetails {
  if (!isCourierSummary(value)) {
    return false;
  }

  const courier = value as Partial<DeliveryCourierDetails>;

  return (
    Array.isArray(courier.days) &&
    courier.days.every(isDaySummary) &&
    Number.isInteger(courier.periodPayoutCents) &&
    Number.isInteger(courier.periodSettledCents)
  );
}

function isDaySummary(value: unknown): value is DeliveryDaySummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const day = value as Partial<DeliveryDaySummary>;

  return (
    (day.closedAt === null || typeof day.closedAt === 'string') &&
    typeof day.courierId === 'string' &&
    typeof day.courierName === 'string' &&
    Number.isInteger(day.dailyRateCents) &&
    Number.isInteger(day.deliveryCount) &&
    Number.isInteger(day.expensesTotalCents) &&
    Number.isInteger(day.feesTotalCents) &&
    typeof day.id === 'string' &&
    typeof day.openedAt === 'string' &&
    Number.isInteger(day.payoutCents) &&
    Number.isInteger(day.salesTotalCents) &&
    (day.settlementPaidCents === null ||
      Number.isInteger(day.settlementPaidCents)) &&
    (day.status === 'OPEN' || day.status === 'CLOSED')
  );
}

function isDayDetails(value: unknown): value is DeliveryDayDetails {
  if (!isDaySummary(value)) {
    return false;
  }

  const day = value as Partial<DeliveryDayDetails>;

  return (
    Array.isArray(day.deliveries) &&
    day.deliveries.every(isDeliveryRecord) &&
    Array.isArray(day.expenses) &&
    day.expenses.every(isExpenseRecord)
  );
}

function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const delivery = value as Partial<DeliveryRecord>;

  return (
    typeof delivery.address === 'string' &&
    typeof delivery.customerName === 'string' &&
    typeof delivery.deliveredAt === 'string' &&
    Number.isInteger(delivery.feeCents) &&
    typeof delivery.id === 'string' &&
    (delivery.paymentMethod === 'CASH' ||
      delivery.paymentMethod === 'PIX' ||
      delivery.paymentMethod === 'DEBIT_CARD' ||
      delivery.paymentMethod === 'CREDIT_CARD') &&
    (delivery.products === null || typeof delivery.products === 'string') &&
    isActor(delivery.recordedBy) &&
    Number.isInteger(delivery.totalCents)
  );
}

function isExpenseRecord(value: unknown): value is DeliveryExpenseRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const expense = value as Partial<DeliveryExpenseRecord>;

  return (
    Number.isInteger(expense.amountCents) &&
    typeof expense.createdAt === 'string' &&
    typeof expense.description === 'string' &&
    typeof expense.id === 'string' &&
    isActor(expense.recordedBy)
  );
}

function isActor(value: unknown) {
  return (
    value === null ||
    (Boolean(value) &&
      typeof (value as DeliveryActor).id === 'string' &&
      typeof (value as DeliveryActor).name === 'string')
  );
}

async function readDay(response: Response) {
  if (!response.ok) {
    throw new Error('Delivery day request failed');
  }

  const payload: unknown = await response.json();
  const day =
    payload && typeof payload === 'object'
      ? (payload as { day?: unknown }).day
      : undefined;

  if (!isDayDetails(day)) {
    throw new Error('Invalid delivery day response');
  }

  return day;
}

function requireApiBaseUrl(value: string) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(value);

  if (!normalizedApiBaseUrl) {
    throw new Error('Missing API URL');
  }

  return normalizedApiBaseUrl;
}

function jsonPost(body: object = {}) {
  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  };
}
