import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuthUser } from '../authentication.js';
import { RoleAccessError, RoleConflictError, RoleInputError, RoleNotFoundError } from '../role-policy.js';
import { type RoleRepository, validVersion } from '../role-repository.js';

export function accessError(error: unknown, reply: FastifyReply) {
  if (error instanceof RoleInputError) return reply.code(400).send({ message: 'Invalid access data' });
  if (error instanceof RoleAccessError) return reply.code(403).send({ message: 'Permission denied' });
  if (error instanceof RoleConflictError) return reply.code(409).send({ message: 'Access changed or role in use; reload' });
  if (error instanceof RoleNotFoundError) return reply.code(404).send({ message: 'Resource not found' });
  return reply.code(503).send({ message: 'Access administration unavailable' });
}
export function registerRoleRoutes(app: FastifyInstance, roles?: RoleRepository) {
  const options = { config: { permission: 'roles.manage' as const } };
  app.get('/admin/roles', options, async (request, reply) => {
    if (!roles) return reply.code(503).send({ message: 'Access administration unavailable' });
    try { return await roles.list(requireAuthUser(request)); } catch (error) { return accessError(error, reply); }
  });
  app.post<{ Body: unknown }>('/admin/roles', options, async (request, reply) => {
    if (!roles) return reply.code(503).send({ message: 'Access administration unavailable' });
    try { return reply.code(201).send({ role: await roles.create(requireAuthUser(request), request.body) }); } catch (error) { return accessError(error, reply); }
  });
  app.patch<{ Params: { id: string }; Body: { expectedVersion?: unknown } }>('/admin/roles/:id', options, async (request, reply) => {
    if (!roles) return reply.code(503).send({ message: 'Access administration unavailable' });
    if (!validVersion(request.body?.expectedVersion)) return reply.code(400).send({ message: 'Invalid version' });
    try { return { role: await roles.update(requireAuthUser(request), request.params.id, request.body, request.body.expectedVersion) }; } catch (error) { return accessError(error, reply); }
  });
  app.delete<{ Params: { id: string }; Body: { expectedVersion?: unknown } }>('/admin/roles/:id', options, async (request, reply) => {
    if (!roles) return reply.code(503).send({ message: 'Access administration unavailable' });
    if (!validVersion(request.body?.expectedVersion) || Object.keys(request.body).some((key) => key !== 'expectedVersion')) return reply.code(400).send({ message: 'Invalid version' });
    try { await roles.remove(requireAuthUser(request), request.params.id, request.body.expectedVersion); return reply.code(204).send(); } catch (error) { return accessError(error, reply); }
  });
}
