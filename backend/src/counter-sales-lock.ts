import type { Transaction } from './comanda-persistence.js';
import { COUNTER_TABLE_NAME } from './counter-sales-types.js';

export async function lockCounterSale(transaction: Transaction, tenantId: string, id: string) {
  const counter = await transaction.comanda.findFirst({
    where: { id, establishmentId: tenantId, tableName: COUNTER_TABLE_NAME }, select: { id: true },
  });
  if (!counter) return undefined;
  const rows = await transaction.$queryRaw<{ status: string }[]>`SELECT status FROM Comanda WHERE id = ${id}
    AND establishmentId = ${tenantId} AND tableName = ${COUNTER_TABLE_NAME} FOR UPDATE`;
  return rows[0];
}
