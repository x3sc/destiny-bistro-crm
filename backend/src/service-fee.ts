import { createHash } from 'node:crypto';
import type { Comanda } from './comanda-types.js';

export class CheckoutConflictError extends Error {}
export class CheckoutInputError extends Error {}
export interface CheckoutOptions { includeServiceFee: boolean; requestId: string; expectedSnapshot: string }
export function parseCheckoutOptions(value: unknown): CheckoutOptions | undefined {
  if (!value || typeof value !== 'object') throw new CheckoutInputError();
  const input = value as Record<string, unknown>;
  const modern = ['includeServiceFee', 'requestId', 'expectedSnapshot'].some((key) => input[key] !== undefined);
  if (Object.keys(input).some((key) => !['payments', 'customerId', 'includeServiceFee', 'requestId', 'expectedSnapshot'].includes(key))) throw new CheckoutInputError();
  if (!modern) return undefined;
  if (typeof input.includeServiceFee !== 'boolean' || typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,191}$/u.test(input.requestId) ||
    typeof input.expectedSnapshot !== 'string' || !/^[a-f0-9]{64}$/u.test(input.expectedSnapshot)) throw new CheckoutInputError();
  return { includeServiceFee: input.includeServiceFee, requestId: input.requestId, expectedSnapshot: input.expectedSnapshot };
}
export function checkoutFingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function serviceFeeCents(subtotal: number, percent: number): number {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || ![0, 10].includes(percent)) throw new CheckoutInputError();
  const fee = (BigInt(subtotal) * BigInt(percent) + 50n) / 100n;
  if (BigInt(subtotal) + fee > 2147483647n) throw new CheckoutInputError();
  return Number(fee);
}
export function checkoutSnapshot(comanda: Comanda) {
  return createHash('sha256').update(JSON.stringify({ id: comanda.id, status: comanda.status, origin: comanda.operationalOrigin,
    creditId: comanda.credit?.orderId, totalCents: comanda.totalCents,
    items: [...comanda.items].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({ id: item.id, quantity: item.quantity,
      confirmedQuantity: item.confirmedQuantity, unitPriceCents: item.unitPriceCents,
      configurations: [...item.configurations].sort((a, b) => a.id.localeCompare(b.id)).map((config) => ({ id: config.id,
        quantity: config.quantity, confirmedQuantity: config.confirmedQuantity,
        additionals: [...config.additionals].sort((a, b) => a.id.localeCompare(b.id)).map((extra) => [extra.id, extra.quantityPerUnit, extra.unitPriceCents]),
      })),
    })),
  })).digest('hex');
}
export function checkoutSummary(comanda: Comanda) {
  const eligible = comanda.status === 'OPEN' && ['TABLE', 'QUICK_SALE'].includes(comanda.operationalOrigin ?? '') && !comanda.credit;
  const subtotalCents = comanda.items.reduce((sum, item) => sum + item.configurations.reduce((total, config) =>
    total + config.confirmedQuantity * (item.unitPriceCents + config.additionals.reduce((value, extra) => value + extra.quantityPerUnit * extra.unitPriceCents, 0)), 0), 0);
  const totalWithoutServiceFeeCents = !eligible ? comanda.totalCents : subtotalCents;
  const amountCents = serviceFeeCents(subtotalCents, eligible ? 10 : 0);
  return { comanda, eligible, canClose: comanda.status === 'OPEN' && !comanda.credit && comanda.operationalOrigin !== 'COUNTER' &&
    comanda.items.every((item) => item.confirmedQuantity === item.quantity), subtotalCents,
    serviceFee: { percent: eligible ? 10 : 0, amountCents }, totalWithoutServiceFeeCents,
    totalWithServiceFeeCents: totalWithoutServiceFeeCents + amountCents, expectedSnapshot: checkoutSnapshot(comanda) };
}
