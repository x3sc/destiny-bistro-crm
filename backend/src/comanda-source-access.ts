import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthUser } from './auth-types.js';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { RoleAccessError } from './role-policy.js';

export const requestAccess = new AsyncLocalStorage<{ actor: AuthUser | null }>();
type Source = { operationalOrigin?: string; tableName?: string | null; credit?: unknown; creditOrder?: unknown; deliveryOrder?: unknown };
export function sourcePermission(source: Source, mode: 'read' | 'write') {
  const scopes: Record<string, string> = { TABLE: 'comandas', QUICK_SALE: 'quick-sales', COUNTER: 'counter-sales', CREDIT: 'credits', DELIVERY: 'deliveries' };
  const module = source.operationalOrigin ? scopes[source.operationalOrigin] : source.credit || source.creditOrder ? 'credits' : source.deliveryOrder ? 'deliveries' :
    source.tableName === 'Balcão' ? 'counter-sales' : source.tableName === 'Venda rápida' ? 'quick-sales' : 'comandas';
  return `${module}.${mode}`;
}
export function assertComandaSource(source: Source, mode: 'read' | 'write') {
  const context = requestAccess.getStore();
  // Internal repository jobs are trusted; every HTTP entry initializes this context.
  if (!context) return;
  if (!context.actor?.permissions.includes(sourcePermission(source, mode))) throw new RoleAccessError();
}
export async function authorizeComandaMutation(tx: Prisma.TransactionClient | PrismaClient, tenant: string, id: string) {
  if (!requestAccess.getStore()) return;
  const rows = await tx.$queryRaw<Source[]>`SELECT c.tableName, co.id AS creditOrder, d.id AS deliveryOrder
    FROM Comanda c LEFT JOIN CreditOrder co ON co.comandaId = c.id AND co.establishmentId = c.establishmentId
    LEFT JOIN DeliveryOrder d ON d.comandaId = c.id AND d.establishmentId = c.establishmentId
    WHERE c.id = ${id} AND c.establishmentId = ${tenant} FOR UPDATE`;
  if (rows[0]) assertComandaSource(rows[0], 'write');
}
