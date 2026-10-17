import type { Comanda } from './comanda-types.js';
import { createHash } from 'node:crypto';

export const COUNTER_TABLE_NAME = 'Balcão';
export class CounterSaleConflictError extends Error {}
interface SnapshotItem {
  id: string; quantity: number; confirmedQuantity: number; unitPriceCents: number; subtotalCents: number;
  configurations?: { id: string; quantity: number; confirmedQuantity: number; configurationKey: string;
    additionals: { additionalId: string; quantityPerUnit: number; unitPriceCents: number }[] }[];
}
export function counterSaleSnapshot(id: string, items: SnapshotItem[]) {
  return createHash('sha256').update(JSON.stringify({ id, items: [...items].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({
    id: item.id, quantity: item.quantity, confirmedQuantity: item.confirmedQuantity,
    unitPriceCents: item.unitPriceCents, subtotalCents: item.subtotalCents,
    configurations: [...(item.configurations ?? [])].sort((a, b) => a.id.localeCompare(b.id)).map((configuration) => ({
      id: configuration.id, key: configuration.configurationKey, quantity: configuration.quantity, confirmedQuantity: configuration.confirmedQuantity,
      additionals: [...configuration.additionals].sort((a, b) => a.additionalId.localeCompare(b.additionalId)).map((additional) => ({
        id: additional.additionalId, quantityPerUnit: additional.quantityPerUnit, unitPriceCents: additional.unitPriceCents,
      })),
    })),
  })) })).digest('hex');
}
export interface CounterSalesRepository {
  open(tenantId: string, actorId: string, requestId: string): Promise<Comanda>;
  list(tenantId: string, status: 'OPEN' | 'CLOSED', date: string): Promise<Comanda[]>;
  rename(tenantId: string, actorId: string, id: string, name: string | null): Promise<Comanda>;
  complete(tenantId: string, actorId: string, id: string, requestId: string, expectedSnapshot: string): Promise<Comanda>;
}
