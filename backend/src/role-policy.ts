import { permissionDefinitions } from './access-control.js';
import type { AuthUser } from './auth-types.js';

export class RoleAccessError extends Error { statusCode = 403; }
export class RoleInputError extends Error {}
export class RoleConflictError extends Error {}
export class RoleNotFoundError extends Error {}
export const administrativePermissions = ['roles.manage', 'users.manage'];
export const permissionCatalog = permissionDefinitions.map(([code, name]) => ({ code, name,
  group: code.split('.')[0],
  dependencies: code.endsWith('.write') ? [`${code.slice(0, -6)}.read`,
    ...(['comandas.write', 'quick-sales.write', 'counter-sales.write', 'credits.write', 'deliveries.write'].includes(code) ? ['products.read'] : [])]
    .filter((dependency) => permissionDefinitions.some(([known]) => known === dependency)) : [],
  ownerOnly: administrativePermissions.includes(code),
}));
export function isOwner(actor: AuthUser) { return actor.roles.some((role) => role.code === 'OWNER'); }
export function isAdministrative(codes: readonly string[]) { return codes.some((code) => administrativePermissions.includes(code)); }
export function validateRolePermissions(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > permissionCatalog.length || new Set(input).size !== input.length ||
    input.some((code) => typeof code !== 'string' || !permissionCatalog.some((permission) => permission.code === code)) ||
    input.some((code) => permissionCatalog.find((permission) => permission.code === code)!.dependencies.some((dependency) => !input.includes(dependency)))) throw new RoleAccessError();
  return input.map((code: unknown) => String(code)).sort();
}
export function canEditRole(actor: AuthUser, role: { id: string; protected: boolean; permissions: readonly string[] }, proposed = role.permissions): boolean {
  if (!actor.permissions.includes('roles.manage') || role.protected) return false;
  if (isOwner(actor)) return true;
  return !actor.roles.some(({ id }) => id === role.id) && !isAdministrative(role.permissions) && !isAdministrative(proposed) &&
    [...role.permissions, ...proposed].every((code) => actor.permissions.includes(code));
}
export function canAssignRole(actor: AuthUser, role: { protected: boolean; permissions: readonly string[] }): boolean {
  if (!actor.permissions.includes('users.manage')) return false;
  return isOwner(actor) || (!role.protected && !isAdministrative(role.permissions) && role.permissions.every((code) => actor.permissions.includes(code)));
}
export function normalizeRoleInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RoleInputError();
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !['name', 'description', 'permissions', 'expectedVersion'].includes(key)) || typeof value.name !== 'string' ||
    (value.description !== undefined && value.description !== null && typeof value.description !== 'string')) throw new RoleInputError();
  const name = value.name.trim().replace(/\s+/gu, ' ');
  const description = typeof value.description === 'string' ? value.description.trim() : null;
  if (name.length < 2 || name.length > 80 || (description?.length ?? 0) > 255) throw new RoleInputError();
  let permissions: string[];
  try { permissions = validateRolePermissions(value.permissions); } catch { throw new RoleInputError(); }
  return { name, normalizedName: name.toLocaleLowerCase('pt-BR'), description, permissions };
}
