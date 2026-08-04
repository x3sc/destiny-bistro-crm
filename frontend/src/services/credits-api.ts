import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';
import type {
  CreditOrderSource,
  CreditOrderStatus,
  Payment,
  PaymentAllocationInput,
} from './comandas-api';

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

export async function loadCreditCustomers(
  apiBaseUrl: string,
  includeInactive = false,
) {
  const query = includeInactive ? '?includeInactive=true' : '';
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/credit-customers${query}`,
  );

  if (!response.ok) {
    throw new Error('Credit customers request failed');
  }

  const payload: unknown = await response.json();
  const customers =
    payload && typeof payload === 'object'
      ? (payload as { customers?: unknown }).customers
      : undefined;

  if (!Array.isArray(customers) || !customers.every(isCreditCustomerSummary)) {
    throw new Error('Invalid credit customers response');
  }

  return customers;
}

export async function createCreditCustomer(apiBaseUrl: string, name: string) {
  return readCustomerSummary(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/credit-customers`,
      jsonPost({ name: name.trim() }),
    ),
  );
}

export async function loadCreditCustomer(
  apiBaseUrl: string,
  customerId: string,
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/credit-customers/${encodeURIComponent(customerId)}`,
  );

  if (!response.ok) {
    throw new Error('Credit customer request failed');
  }

  const payload: unknown = await response.json();
  const customer =
    payload && typeof payload === 'object'
      ? (payload as { customer?: unknown }).customer
      : undefined;

  if (!isCreditCustomerDetails(customer)) {
    throw new Error('Invalid credit customer response');
  }

  return customer;
}

export async function createCreditOrder(
  apiBaseUrl: string,
  customerId: string,
) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/credit-customers/${encodeURIComponent(customerId)}/orders`,
      jsonPost(),
    ),
  );
}

export async function finalizeCreditOrder(
  apiBaseUrl: string,
  orderId: string,
) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/credit-orders/${encodeURIComponent(orderId)}/finalize`,
      jsonPost(),
    ),
  );
}

export async function cancelCreditOrder(
  apiBaseUrl: string,
  orderId: string,
) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/credit-orders/${encodeURIComponent(orderId)}/cancel`,
      jsonPost(),
    ),
  );
}

export async function settleCreditOrder(
  apiBaseUrl: string,
  orderId: string,
  payments: PaymentAllocationInput[],
) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/credit-orders/${encodeURIComponent(orderId)}/settle`,
    jsonPost({ payments }),
  );

  if (!response.ok) {
    throw new Error('Credit settlement request failed');
  }

  const payload: unknown = await response.json();
  const result =
    payload && typeof payload === 'object'
      ? (payload as { order?: unknown; payment?: unknown })
      : undefined;

  if (!result || !isCreditOrder(result.order) || !isPayment(result.payment)) {
    throw new Error('Invalid credit settlement response');
  }

  return { order: result.order, payment: result.payment };
}

export async function convertComandaToCredit(
  apiBaseUrl: string,
  comandaId: string,
  customerId: string,
) {
  return readOrder(
    await authenticatedFetch(
      `${requireApiBaseUrl(apiBaseUrl)}/comandas/${encodeURIComponent(comandaId)}/credit`,
      jsonPost({ customerId }),
    ),
  );
}

function isCreditCustomerSummary(
  value: unknown,
): value is CreditCustomerSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const customer = value as Partial<CreditCustomerSummary>;

  return (
    Number.isInteger(customer.balanceCents) &&
    Number.isInteger(customer.draftOrderCount) &&
    typeof customer.id === 'string' &&
    typeof customer.name === 'string' &&
    Number.isInteger(customer.openOrderCount)
  );
}

function isCreditCustomerDetails(
  value: unknown,
): value is CreditCustomerDetails {
  if (!isCreditCustomerSummary(value)) {
    return false;
  }

  const customer = value as Partial<CreditCustomerDetails>;

  return (
    Array.isArray(customer.orders) &&
    customer.orders.every(isCreditOrder)
  );
}

function isCreditOrder(value: unknown): value is CreditOrder {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const order = value as Partial<CreditOrder>;

  return (
    Number.isInteger(order.balanceCents) &&
    (order.cancelledAt === null || typeof order.cancelledAt === 'string') &&
    typeof order.comandaId === 'string' &&
    (order.comandaName === null || typeof order.comandaName === 'string') &&
    Number.isInteger(order.comandaNumber) &&
    typeof order.customerId === 'string' &&
    typeof order.customerName === 'string' &&
    (order.finalizedAt === null || typeof order.finalizedAt === 'string') &&
    typeof order.hasPendingItems === 'boolean' &&
    typeof order.id === 'string' &&
    typeof order.orderedAt === 'string' &&
    Number.isInteger(order.paidCents) &&
    Array.isArray(order.payments) &&
    order.payments.every(isPayment) &&
    (order.settledAt === null || typeof order.settledAt === 'string') &&
    (order.source === 'MANUAL' || order.source === 'TABLE') &&
    (order.status === 'DRAFT' ||
      order.status === 'OPEN' ||
      order.status === 'SETTLED' ||
      order.status === 'CANCELLED') &&
    (order.tableNumber === null || Number.isInteger(order.tableNumber)) &&
    Number.isInteger(order.totalCents)
  );
}

function isPayment(value: unknown): value is Payment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payment = value as Partial<Payment>;

  return (
    Array.isArray(payment.allocations) &&
    payment.allocations.every(
      (allocation) =>
        typeof allocation.id === 'string' &&
        Number.isInteger(allocation.amountCents) &&
        (allocation.method === 'CASH' ||
          allocation.method === 'PIX' ||
          allocation.method === 'DEBIT_CARD' ||
          allocation.method === 'CREDIT_CARD'),
    ) &&
    Number.isInteger(payment.amountCents) &&
    (payment.creditOrderId === null || typeof payment.creditOrderId === 'string') &&
    typeof payment.id === 'string' &&
    (payment.origin === 'TABLE_CHECKOUT' || payment.origin === 'CREDIT_INSTALLMENT') &&
    typeof payment.paidAt === 'string' &&
    (payment.recordedBy === null ||
      (typeof payment.recordedBy?.id === 'string' &&
        typeof payment.recordedBy?.name === 'string'))
  );
}

async function readCustomerSummary(response: Response) {
  if (!response.ok) {
    throw new Error('Credit customer request failed');
  }

  const payload: unknown = await response.json();
  const customer =
    payload && typeof payload === 'object'
      ? (payload as { customer?: unknown }).customer
      : undefined;

  if (!isCreditCustomerSummary(customer)) {
    throw new Error('Invalid credit customer response');
  }

  return customer;
}

async function readOrder(response: Response) {
  if (!response.ok) {
    throw new Error('Credit order request failed');
  }

  const payload: unknown = await response.json();
  const order =
    payload && typeof payload === 'object'
      ? (payload as { order?: unknown }).order
      : undefined;

  if (!isCreditOrder(order)) {
    throw new Error('Invalid credit order response');
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
