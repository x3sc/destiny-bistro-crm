import { isComanda, type Comanda } from './comandas-api';
import { authenticatedFetch } from './auth-session';
import { normalizeApiBaseUrl } from './api-base-url';

export class CounterSaleConflictError extends Error {}
export function counterRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `counter-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}
export function counterToday() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function endpoint(url: string, suffix = '') {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) throw new Error('API indisponível');
  return `${normalized}/counter-sales${suffix}`;
}
function isCounter(value: unknown): value is Comanda {
  return isComanda(value) && value.tableName === 'Balcão' && value.table === null && value.credit === null;
}
async function mutation(url: string, method: 'POST' | 'PUT', body: object) {
  const response = await authenticatedFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (response.status === 409) throw new CounterSaleConflictError('A comanda mudou. Recarregue os dados.');
  if (!response.ok) throw new Error('Não foi possível registrar a operação.');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !isCounter((payload as { comanda?: unknown }).comanda)) throw new Error('Resposta inválida');
  return (payload as { comanda: Comanda }).comanda;
}
export async function loadCounterSales(url: string, status: 'OPEN' | 'CLOSED', date: string): Promise<Comanda[]> {
  const response = await authenticatedFetch(endpoint(url, `?status=${status}&date=${encodeURIComponent(date)}`));
  if (!response.ok) throw new Error('Balcão indisponível');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('comandas' in payload) || !Array.isArray(payload.comandas) || !payload.comandas.every(isCounter)) throw new Error('Resposta inválida');
  return payload.comandas;
}
export async function openCounterSale(url: string, requestId: string) { return mutation(endpoint(url), 'POST', { requestId }); }
export async function completeCounterSale(url: string, id: string, requestId: string, expectedSnapshot: string) {
  const sale = await mutation(endpoint(url, `/${encodeURIComponent(id)}/complete`), 'POST', { requestId, expectedSnapshot });
  if (sale.status !== 'CLOSED' || !sale.payments.some((payment) => payment.origin === 'COUNTER_CHECKOUT' && payment.amountCents === sale.totalCents &&
    payment.allocations.length === 1 && payment.allocations[0].method === 'COUNTER' && payment.allocations[0].amountCents === sale.totalCents)) throw new Error('Confirmação de pagamento inválida');
  return sale;
}
export async function renameCounterSale(url: string, id: string, name: string) { return mutation(endpoint(url, `/${encodeURIComponent(id)}/name`), 'PUT', { name: name.trim() || null }); }
