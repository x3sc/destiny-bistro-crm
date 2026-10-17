import { normalizeUserName, validatePassword } from './auth-repository.js';
import { AuthInputError, UserProvisionConflictError, type AuthUser } from './auth-types.js';
import { createAuditData } from './audit.js';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { hashPassword } from './password.js';
import { canAssignRole, isOwner, RoleAccessError, RoleConflictError, RoleNotFoundError } from './role-policy.js';
import { accessTransaction, freshActor, mapTenantRole, tenantRoleSelect, validVersion } from './role-repository.js';
import type { UserRepository } from './user-types.js';

const userSelect = { id: true, name: true, active: true, roleVersion: true,
  localRole: { select: tenantRoleSelect } } satisfies Prisma.UserSelect;
function mapUser(user: Prisma.UserGetPayload<{ select: typeof userSelect }>, actor: AuthUser) {
  const role = mapTenantRole(user.localRole);
  return { id: user.id, name: user.name, active: user.active, roleVersion: user.roleVersion,
    roles: [{ id: role.id, code: role.code, name: role.name }], permissions: role.permissions,
    canReassign: user.id !== actor.id && canAssignRole(actor, role) };
}
export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async list(actor) {
      return prisma.$transaction(async (tx) => {
        const current = await freshActor(tx, actor, 'users.manage');
        const [users, roles] = await Promise.all([
          tx.user.findMany({ where: { establishmentId: current.establishment.id }, select: userSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
          tx.tenantRole.findMany({ where: { establishmentId: current.establishment.id }, select: tenantRoleSelect, orderBy: { name: 'asc' } }),
        ]);
        const order = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN'];
        return { users: users.map((user) => mapUser(user, current)), roles: roles.map(mapTenantRole).filter((role) => canAssignRole(current, role))
          .sort((a, b) => (order.indexOf(a.code) < 0 ? 99 : order.indexOf(a.code)) - (order.indexOf(b.code) < 0 ? 99 : order.indexOf(b.code))) };
      });
    },
    async create(actor, input) {
      const { name, normalizedName } = normalizeUserName(input.name);
      validatePassword(input.password);
      if (Boolean(input.roleId) === Boolean(input.roleCode)) throw new AuthInputError();
      const passwordHash = await hashPassword(input.password);
      try {
        return await accessTransaction(prisma, actor, 'users.manage', async (tx, current) => {
          const role = await tx.tenantRole.findFirst({ where: { establishmentId: current.establishment.id,
            ...(input.roleId ? { id: input.roleId } : { code: input.roleCode! }) }, select: tenantRoleSelect });
          if (!role) throw new AuthInputError();
          if (!canAssignRole(current, mapTenantRole(role))) throw new RoleAccessError();
          const user = await tx.user.create({ data: { establishmentId: current.establishment.id, localRoleId: role.id,
            name, normalizedName, passwordHash }, select: userSelect });
          await tx.auditLog.create({ data: createAuditData({ action: 'USER_CREATED', establishmentId: current.establishment.id,
            resourceId: user.id, resourceType: 'USER', userId: current.id, metadata: { roleId: role.id, roleCode: role.code } }) });
          return mapUser(user, current);
        });
      } catch (error) { if (error instanceof RoleConflictError) throw new UserProvisionConflictError(); throw error; }
    },
    async updateRole(actor, id, roleId, expectedVersion) {
      return accessTransaction(prisma, actor, 'users.manage', async (tx, current) => {
        const [user, proposed] = await Promise.all([
          tx.user.findFirst({ where: { id, establishmentId: current.establishment.id }, select: userSelect }),
          tx.tenantRole.findFirst({ where: { id: roleId, establishmentId: current.establishment.id }, select: tenantRoleSelect }),
        ]);
        if (!user || !proposed) throw new RoleNotFoundError();
        const before = mapTenantRole(user.localRole), after = mapTenantRole(proposed);
        if (current.id === id || !canAssignRole(current, before) || !canAssignRole(current, after)) throw new RoleAccessError();
        if (!validVersion(expectedVersion) || user.roleVersion !== expectedVersion) throw new RoleConflictError();
        if (before.protected && user.active && !after.protected) {
          if (!isOwner(current) || await tx.user.count({ where: { establishmentId: current.establishment.id, active: true, localRole: { protected: true } } }) <= 1) throw new RoleAccessError();
        }
        if (before.id === after.id) return mapUser(user, current);
        const updated = await tx.user.update({ where: { id_establishmentId: { id, establishmentId: current.establishment.id } },
          data: { localRoleId: after.id, roleVersion: { increment: 1 } }, select: userSelect });
        await tx.auditLog.create({ data: createAuditData({ action: 'USER_ROLE_CHANGED', establishmentId: current.establishment.id,
          resourceId: id, resourceType: 'USER', userId: current.id, metadata: { before: { roleId: before.id, permissions: before.permissions }, after: { roleId: after.id, permissions: after.permissions } } }) });
        return mapUser(updated, current);
      });
    },
  };
}
