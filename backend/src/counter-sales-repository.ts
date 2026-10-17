import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { createAuditData } from './audit.js';
import { allocateComandaIdentity, type Clock } from './comanda-numbering.js';
import { comandaSelect, getComandaOrThrow, mapComanda, type Transaction } from './comanda-persistence.js';
import { ComandaNotFoundError, type Comanda } from './comanda-types.js';
import { COUNTER_TABLE_NAME, CounterSaleConflictError, counterSaleSnapshot, type CounterSalesRepository } from './counter-sales-types.js';
import { lockCounterSale } from './counter-sales-lock.js';
import { authorizeComandaMutation } from './comanda-source-access.js';
import { createPayment } from './payment-persistence.js';
import { parseStatementPeriod } from './statement-report.js';

export function createCounterSalesRepository(prisma: PrismaClient, clock: Clock = () => new Date()): CounterSalesRepository {
  async function operation(tenantId: string, actorId: string, requestId: string, action: 'OPEN' | 'COMPLETE',
    resourceId: string | null, work: (tx: Transaction) => Promise<Comanda>, expectedSnapshot?: string) {
    const fingerprint = createHash('sha256').update(JSON.stringify({ actorId, action, resourceId, expectedSnapshot })).digest('hex');
    const replay = async () => {
      const existing = await prisma.counterSaleOperation.findUnique({
        where: { establishmentId_requestId: { establishmentId: tenantId, requestId } },
      });
      if (!existing) return null;
      if (existing.requestFingerprint !== fingerprint) throw new CounterSaleConflictError();
      return getComandaOrThrow(prisma, tenantId, existing.comandaId);
    };
    const previous = await replay();
    if (previous) return previous;
    try {
      return await prisma.$transaction(async (tx) => {
        const result = await work(tx);
        await tx.counterSaleOperation.create({ data: { establishmentId: tenantId, actorUserId: actorId,
          comandaId: result.id, action, requestId, requestFingerprint: fingerprint } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof CounterSaleConflictError || (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034'))) {
        const committed = await replay();
        if (committed) return committed;
      }
      throw error;
    }
  }
  const counterWhere = (tenantId: string, id?: string) => ({ establishmentId: tenantId, ...(id ? { id } : {}),
    tableId: null, tableName: COUNTER_TABLE_NAME, creditOrder: { is: null }, deliveryOrder: { is: null } });
  async function editable(tx: Transaction, tenantId: string, id: string) {
    await authorizeComandaMutation(tx, tenantId, id);
    await lockCounterSale(tx, tenantId, id);
    const sale = await tx.comanda.findFirst({ where: counterWhere(tenantId, id), select: comandaSelect });
    if (!sale) throw new ComandaNotFoundError();
    if (sale.status !== 'OPEN') throw new CounterSaleConflictError();
    return sale;
  }
  return {
    async open(tenantId, actorId, requestId) {
      return operation(tenantId, actorId, requestId, 'OPEN', null, async (tx) => {
        const identity = await allocateComandaIdentity(tx, tenantId, clock());
        const sale = await tx.comanda.create({ data: { ...identity, establishmentId: tenantId, tableId: null,
          tableName: COUNTER_TABLE_NAME, events: { create: { actorUserId: actorId, type: 'OPENED' } } }, select: comandaSelect });
        await tx.auditLog.create({ data: createAuditData({ action: 'COUNTER_SALE_OPENED', establishmentId: tenantId,
          userId: actorId, resourceId: sale.id, resourceType: 'COMANDA', metadata: { requestId, source: 'COUNTER' } }) });
        return mapComanda(sale);
      });
    },
    async list(tenantId, status, date) {
      const period = parseStatementPeriod(date, date);
      return (await prisma.comanda.findMany({ where: { ...counterWhere(tenantId), status,
        ...(status === 'CLOSED' ? { closedAt: { gte: period.startAt, lt: period.endAt } } : {}) },
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }], select: comandaSelect })).map(mapComanda);
    },
    async rename(tenantId, actorId, id, name) {
      return prisma.$transaction(async (tx) => {
        const sale = await editable(tx, tenantId, id);
        if (sale.name !== name) {
          await tx.comanda.update({ where: { id_establishmentId: { id, establishmentId: tenantId } }, data: { name } });
          await tx.auditLog.create({ data: createAuditData({ action: 'COUNTER_SALE_NAMED', establishmentId: tenantId,
            userId: actorId, resourceId: id, resourceType: 'COMANDA', metadata: { name } }) });
        }
        return getComandaOrThrow(tx, tenantId, id);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    },
    async complete(tenantId, actorId, id, requestId, expectedSnapshot) {
      return operation(tenantId, actorId, requestId, 'COMPLETE', id, async (tx) => {
        const sale = await editable(tx, tenantId, id);
        const currentSnapshot = counterSaleSnapshot(id, sale.items.map((item) => ({ ...item, subtotalCents: item.quantity * item.unitPriceCents + item.additionalTotalCents })));
        if (expectedSnapshot !== currentSnapshot) throw new CounterSaleConflictError();
        const totalCents = sale.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents + item.additionalTotalCents, 0);
        if (sale.items.length === 0 || sale.items.some((item) => item.quantity !== item.confirmedQuantity) ||
          !Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 2147483647 || sale.payments.length > 0) throw new CounterSaleConflictError();
        const closedAt = clock();
        await tx.comanda.update({ where: { id_establishmentId: { id, establishmentId: tenantId } }, data: { status: 'CLOSED', closedAt } });
        await createPayment(tx, { establishmentId: tenantId, actorUserId: actorId, comandaId: id,
          allocations: [{ method: 'COUNTER', amountCents: totalCents }], amountCents: totalCents, origin: 'COUNTER_CHECKOUT', paidAt: closedAt });
        await tx.comandaEvent.create({ data: { establishmentId: tenantId, comandaId: id, actorUserId: actorId, type: 'CLOSED' } });
        await tx.auditLog.create({ data: createAuditData({ action: 'COUNTER_SALE_COMPLETED', establishmentId: tenantId,
          userId: actorId, resourceId: id, resourceType: 'COMANDA', metadata: {
            requestId, totalCents, paymentMethod: 'COUNTER', paymentOrigin: 'COUNTER_CHECKOUT',
            externalPayment: true, confirmation: 'OPERATOR_RECORDED',
          } }) });
        return getComandaOrThrow(tx, tenantId, id);
      }, expectedSnapshot);
    },
  };
}
