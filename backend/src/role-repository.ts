import { randomUUID } from 'node:crypto';
import type { AuthUser } from './auth-types.js';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { createAuditData } from './audit.js';
import { canEditRole, isOwner, normalizeRoleInput, permissionCatalog, RoleAccessError, RoleConflictError, RoleInputError, RoleNotFoundError } from './role-policy.js';

export const tenantRoleSelect = { id: true, code: true, name: true, description: true, protected: true, version: true,
  permissions: { select: { permission: { select: { code: true } } } }, _count: { select: { users: true } } } satisfies Prisma.TenantRoleSelect;
export type RoleRecord = Prisma.TenantRoleGetPayload<{ select: typeof tenantRoleSelect }>;
export function mapTenantRole(role: RoleRecord) {
  return { id: role.id, code: role.code, name: role.name, description: role.description, protected: role.protected,
    version: role.version, userCount: role._count.users, permissions: role.permissions.map(({ permission }) => permission.code).sort() };
}
export type TenantRoleView = ReturnType<typeof mapTenantRole>;
export interface RoleRepository {
  list(actor: AuthUser): Promise<{ roles: (TenantRoleView & { canEdit: boolean; canDelete: boolean })[]; permissions: typeof permissionCatalog }>;
  create(actor: AuthUser, input: unknown): Promise<TenantRoleView>;
  update(actor: AuthUser, id: string, input: unknown, expectedVersion: number): Promise<TenantRoleView>;
  remove(actor: AuthUser, id: string, expectedVersion: number): Promise<void>;
}
export async function freshActor(tx: Prisma.TransactionClient, actor: AuthUser, permission: string) {
  const user = await tx.user.findFirst({ where: { id: actor.id, establishmentId: actor.establishment.id, active: true },
    select: { id: true, name: true, establishment: { select: { id: true, name: true } }, localRole: { select: tenantRoleSelect } } });
  if (!user) throw new RoleAccessError();
  const role = mapTenantRole(user.localRole);
  const current: AuthUser = { id: user.id, name: user.name, establishment: user.establishment, permissions: role.permissions,
    roles: [{ id: role.id, code: role.code, name: role.name }] };
  if (!current.permissions.includes(permission)) throw new RoleAccessError();
  return current;
}
export async function accessTransaction<T>(prisma: PrismaClient, actor: AuthUser, permission: string,
  work: (tx: Prisma.TransactionClient, current: AuthUser) => Promise<T>) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Establishment WHERE id = ${actor.establishment.id} FOR UPDATE`;
      return work(tx, await freshActor(tx, actor, permission));
    }, { isolationLevel: 'ReadCommitted' });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new RoleConflictError();
    throw error;
  }
}
export function validVersion(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0; }
export function createRoleRepository(prisma: PrismaClient): RoleRepository {
  const load = async (tx: Prisma.TransactionClient, tenant: string, id: string) => {
    const role = await tx.tenantRole.findFirst({ where: { establishmentId: tenant, id }, select: tenantRoleSelect });
    if (!role) throw new RoleNotFoundError();
    return mapTenantRole(role);
  };
  const save = async (actor: AuthUser, id: string | null, input: unknown, version?: number) => {
    const data = normalizeRoleInput(input);
    return accessTransaction(prisma, actor, 'roles.manage', async (tx, current) => {
      const old = id ? await load(tx, current.establishment.id, id) : null;
      if (!canEditRole(current, old ?? { id: '', protected: false, permissions: [] }, data.permissions)) throw new RoleAccessError();
      if (old && (!validVersion(version) || old.version !== version)) throw new RoleConflictError();
      const permissionRows = await tx.permission.findMany({ where: { code: { in: data.permissions } }, select: { id: true } });
      if (permissionRows.length !== data.permissions.length) throw new RoleInputError();
      if (old) await tx.tenantRolePermission.deleteMany({ where: { roleId: old.id, establishmentId: current.establishment.id } });
      const role = await (old ? tx.tenantRole.update({ where: { id_establishmentId: { id: old.id, establishmentId: current.establishment.id } },
        data: { name: data.name, normalizedName: data.normalizedName, description: data.description, version: { increment: 1 },
          permissions: { create: permissionRows.map((p) => ({ permissionId: p.id })) } }, select: tenantRoleSelect }) :
        tx.tenantRole.create({ data: { establishmentId: current.establishment.id, code: `CUSTOM_${randomUUID()}`,
          name: data.name, normalizedName: data.normalizedName, description: data.description,
          permissions: { create: permissionRows.map((p) => ({ permissionId: p.id })) } }, select: tenantRoleSelect }));
      const result = mapTenantRole(role);
      await tx.auditLog.create({ data: createAuditData({ action: old ? 'ROLE_UPDATED' : 'ROLE_CREATED', establishmentId: current.establishment.id,
        userId: current.id, resourceType: 'ROLE', resourceId: role.id, metadata: { before: old, after: result } }) });
      return result;
    });
  };
  return {
    async list(actor) {
      return prisma.$transaction(async (tx) => {
        const current = await freshActor(tx, actor, 'roles.manage');
        const roles = await tx.tenantRole.findMany({ where: { establishmentId: current.establishment.id }, select: tenantRoleSelect, orderBy: [{ protected: 'desc' }, { name: 'asc' }] });
        return { roles: roles.map((record) => { const role = mapTenantRole(record); const allowed = canEditRole(current, role);
          return { ...role, canEdit: allowed, canDelete: allowed && role.userCount === 0 }; }),
        permissions: permissionCatalog.map((permission) => ({ ...permission, ownerOnly: !isOwner(current) && (permission.ownerOnly || !current.permissions.includes(permission.code)) })) };
      });
    },
    create: (actor, input) => save(actor, null, input),
    update: (actor, id, input, expectedVersion) => save(actor, id, input, expectedVersion),
    async remove(actor, id, expectedVersion) {
      return accessTransaction(prisma, actor, 'roles.manage', async (tx, current) => {
        const role = await load(tx, current.establishment.id, id);
        if (!canEditRole(current, role)) throw new RoleAccessError();
        if (!validVersion(expectedVersion) || expectedVersion !== role.version || role.userCount) throw new RoleConflictError();
        await tx.auditLog.create({ data: createAuditData({ action: 'ROLE_DELETED', establishmentId: current.establishment.id,
          userId: current.id, resourceType: 'ROLE', resourceId: id, metadata: { before: role } }) });
        await tx.tenantRole.delete({ where: { id_establishmentId: { id, establishmentId: current.establishment.id } } });
      });
    },
  };
}
