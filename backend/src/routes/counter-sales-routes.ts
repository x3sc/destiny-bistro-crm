import { RoleAccessError } from "../role-policy.js";
import type { FastifyInstance } from 'fastify';
import { requireAuthUser } from '../authentication.js';
import { CounterSaleConflictError, type CounterSalesRepository } from '../counter-sales-types.js';
import { ComandaNotFoundError } from '../comanda-types.js';
import { comandaOpenedDate } from '../comanda-numbering.js';
import { parseStatementPeriod, StatementPeriodError } from '../statement-report.js';

const requestBody = { type: 'object', additionalProperties: false, required: ['requestId'],
  properties: { requestId: { type: 'string', minLength: 8, maxLength: 191, pattern: '^[A-Za-z0-9_-]+$' } } } as const;

async function rejectExtraRequestFields(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
  const allowed = request.routeOptions.url?.endsWith('/complete') ? ['requestId', 'expectedSnapshot'] : ['requestId'];
  if (request.body && typeof request.body === 'object' && Object.keys(request.body).some((key) => !allowed.includes(key))) {
    return reply.code(400).send({ message: 'Unsupported request fields' });
  }
}

export function registerCounterSalesRoutes(app: FastifyInstance, repository?: CounterSalesRepository) {
  const run = async (work: (repo: CounterSalesRepository) => Promise<unknown>, reply: import('fastify').FastifyReply) => {
    if (!repository) return reply.code(503).send({ message: 'Counter sales unavailable' });
    try { return await work(repository); }
    catch (error) {
      if (error instanceof RoleAccessError) return reply.code(403).send({ status: "error", message: "Permission denied" });
      if (error instanceof ComandaNotFoundError) return reply.code(404).send({ message: 'Counter sale not found' });
      if (error instanceof CounterSaleConflictError) return reply.code(409).send({ message: 'Counter sale changed; reload before retrying' });
      if (error instanceof StatementPeriodError) return reply.code(400).send({ message: 'Invalid date' });
      app.log.error(error, 'Counter sale operation failed');
      return reply.code(503).send({ message: 'Counter sales unavailable' });
    }
  };
  app.post<{ Body: { requestId: string } }>('/counter-sales', {
    config: { permission: 'counter-sales.write' }, preValidation: rejectExtraRequestFields, schema: { body: requestBody },
  }, async (request, reply) => run(async (repo) => {
    const user = requireAuthUser(request);
    return { comanda: await repo.open(user.establishment.id, user.id, request.body.requestId) };
  }, reply));
  app.get<{ Querystring: { status?: 'OPEN' | 'CLOSED'; date?: string } }>('/counter-sales', {
    config: { permission: 'counter-sales.read' }, schema: { querystring: { type: 'object', additionalProperties: false,
      properties: { status: { enum: ['OPEN', 'CLOSED'] }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } } },
  }, async (request, reply) => run(async (repo) => {
    const date = request.query.date ?? comandaOpenedDate(new Date());
    parseStatementPeriod(date, date);
    return { comandas: await repo.list(requireAuthUser(request).establishment.id, request.query.status ?? 'OPEN', date) };
  }, reply));
  app.put<{ Params: { id: string }; Body: { name: string | null } }>('/counter-sales/:id/name', {
    config: { permission: 'counter-sales.write' }, schema: { body: { type: 'object', additionalProperties: false,
      required: ['name'], properties: { name: { anyOf: [{ type: 'string', maxLength: 80 }, { type: 'null' }] } } } },
  }, async (request, reply) => run(async (repo) => {
    const user = requireAuthUser(request);
    return { comanda: await repo.rename(user.establishment.id, user.id, request.params.id, request.body.name?.trim() || null) };
  }, reply));
  app.post<{ Params: { id: string }; Body: { requestId: string; expectedSnapshot: string } }>('/counter-sales/:id/complete', {
    config: { permission: 'counter-sales.write' }, preValidation: rejectExtraRequestFields, schema: { body: { ...requestBody,
      required: ['requestId', 'expectedSnapshot'], properties: { ...requestBody.properties, expectedSnapshot: { type: 'string', pattern: '^[a-f0-9]{64}$' } } } },
  }, async (request, reply) => run(async (repo) => {
    const user = requireAuthUser(request);
    return { comanda: await repo.complete(user.establishment.id, user.id, request.params.id, request.body.requestId, request.body.expectedSnapshot) };
  }, reply));
}
