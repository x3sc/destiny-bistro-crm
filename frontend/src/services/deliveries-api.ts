import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';
import type { PaymentMethod } from './comandas-api';

export type DeliveryDayStatus = 'OPEN' | 'CLOSED';
export type DeliveryOrderStatus =
  | 'NEW'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';
export type DeliveryOrderPaymentStatus = 'OPEN' | 'PAID' | 'CREDIT';

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

export interface DeliveryOrderDraft {
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

export async function loadDeliveryOrders(
  apiBaseUrl: string,
  includeDelivered = false,
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/delivery/orders${includeDelivered ? '?history=true' : ''}`,
  );
  if (!response.ok) throw new Error('Delivery orders request failed');

  const payload: unknown = await response.json();
  const orders =
    payload && typeof payload === 'object'
      ? (payload as { orders?: unknown }).orders
      : undefined;
  if (!Array.isArray(orders) || !orders.every(isDeliveryOrder)) {
    throw new Error('Invalid delivery orders response');
  }
  return orders;
}

export async function createDeliveryOrder(
  apiBaseUrl: string,
  draft: DeliveryOrderDraft,
) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/orders`,
      jsonPost(draft),
    ),
  );
}

export async function loadDeliveryOrder(apiBaseUrl: string, orderId: string) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/orders/${encodeURIComponent(orderId)}`,
    ),
  );
}

export async function advanceDeliveryOrder(
  apiBaseUrl: string,
  orderId: string,
  status: Exclude<DeliveryOrderStatus, 'NEW'>,
  dayId?: string,
) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/delivery/orders/${encodeURIComponent(orderId)}/status`,
      jsonPost({ status, ...(dayId ? { dayId } : {}) }),
    ),
  );
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

function isDeliveryOrder(value: unknown): value is DeliveryOrder {
  if (!value || typeof value !== 'object') return false;
  const order = value as Partial<DeliveryOrder>;
  return (
    typeof order.address === 'string' &&
    typeof order.comandaId === 'string' &&
    Number.isInteger(order.comandaNumber) &&
    (order.courierName === null || typeof order.courierName === 'string') &&
    typeof order.createdAt === 'string' &&
    typeof order.customerName === 'string' &&
    (order.dayId === null || typeof order.dayId === 'string') &&
    (order.deliveredAt === null || typeof order.deliveredAt === 'string') &&
    (order.dispatchedAt === null || typeof order.dispatchedAt === 'string') &&
    Number.isInteger(order.feeCents) &&
    typeof order.hasPendingItems === 'boolean' &&
    typeof order.id === 'string' &&
    Number.isInteger(order.itemCount) &&
    Number.isInteger(order.paidCents) &&
    (order.paymentStatus === 'OPEN' ||
      order.paymentStatus === 'PAID' ||
      order.paymentStatus === 'CREDIT') &&
    typeof order.phone === 'string' &&
    (order.status === 'NEW' ||
      order.status === 'PREPARING' ||
      order.status === 'READY' ||
      order.status === 'OUT_FOR_DELIVERY' ||
      order.status === 'DELIVERED') &&
    Number.isInteger(order.totalCents) &&
    typeof order.updatedAt === 'string'
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

async function readOrder(response: Response) {
  if (!response.ok) throw new Error('Delivery order request failed');
  const payload: unknown = await response.json();
  const order =
    payload && typeof payload === 'object'
      ? (payload as { order?: unknown }).order
      : undefined;
  if (!isDeliveryOrder(order)) {
    throw new Error('Invalid delivery order response');
  }
  return order;
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
