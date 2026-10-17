import { authenticatedFetch } from './auth-session';
import { normalizeApiBaseUrl } from './api-base-url';
import { isComanda, CheckoutApiError, type Comanda } from './comandas-api';

export interface CheckoutOptions { includeServiceFee: boolean; expectedSnapshot: string; requestId: string }
export interface CheckoutSummaryResponse {
  comanda: Comanda; eligible: boolean; canClose: boolean; subtotalCents: number;
  serviceFee: { percent: number; amountCents: number }; totalWithoutServiceFeeCents: number;
  totalWithServiceFeeCents: number; expectedSnapshot: string;
}
export async function loadCheckoutSummary(base: string, id: string): Promise<CheckoutSummaryResponse> {
  const url = normalizeApiBaseUrl(base);
  if (!url) throw new CheckoutApiError(503);
  const response = await authenticatedFetch(`${url}/comandas/${encodeURIComponent(id)}/checkout-summary`);
  if (!response.ok) throw new CheckoutApiError(response.status);
  const value = await response.json() as Partial<CheckoutSummaryResponse>;
  const cents = (number: unknown) => Number.isSafeInteger(number) && Number(number) >= 0;
  if (!value || !isComanda(value.comanda) || typeof value.eligible !== 'boolean' || typeof value.canClose !== 'boolean' ||
    !cents(value.subtotalCents) || !cents(value.serviceFee?.amountCents) || ![0, 10].includes(value.serviceFee?.percent ?? -1) ||
    !cents(value.totalWithoutServiceFeeCents) || !cents(value.totalWithServiceFeeCents) ||
    value.totalWithServiceFeeCents !== value.totalWithoutServiceFeeCents! + value.serviceFee!.amountCents ||
    typeof value.expectedSnapshot !== 'string' || !/^[a-f0-9]{64}$/.test(value.expectedSnapshot)) throw new CheckoutApiError(502);
  return value as CheckoutSummaryResponse;
}
