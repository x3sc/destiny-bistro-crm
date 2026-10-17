import { systemRoleDefinitions, permissionDefinitions } from './access-control.js';
import type { Prisma } from './generated/prisma/client.js';

export async function createInitialTenantRoles(tx: Prisma.TransactionClient, establishmentId: string) {
  const permissions = await tx.permission.findMany({ select: { id: true, code: true } });
  for (const definition of systemRoleDefinitions) {
    const codes = new Set<string>(definition.permissions);
    if (definition.code !== 'OWNER') { codes.delete('users.manage'); codes.delete('roles.manage'); }
    if (codes.has('comandas.read')) { codes.add('quick-sales.read'); codes.add('counter-sales.read'); }
    if (codes.has('comandas.write')) { codes.add('quick-sales.write'); codes.add('counter-sales.write'); }
    if (definition.code === 'OWNER') permissionDefinitions.forEach(([code]) => codes.add(code));
    await tx.tenantRole.create({ data: { establishmentId, code: definition.code, name: definition.name,
      normalizedName: definition.name.toLocaleLowerCase('pt-BR'), description: definition.description,
      protected: definition.code === 'OWNER', permissions: { create: permissions.filter((permission) => codes.has(permission.code))
        .map((permission) => ({ permissionId: permission.id })) } } });
  }
}
