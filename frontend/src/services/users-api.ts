import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export type UserRoleCode = 'OWNER' | 'MANAGER' | 'WAITER' | 'KITCHEN';
export interface UserRole { id: string; code: string; name: string; permissions?: string[]; protected?: boolean; version?: number }
export interface AdminUser { id: string; name: string; active: boolean; roles: UserRole[]; roleVersion?: number; permissions?: string[]; canReassign?: boolean }
export interface AdminUsers { users: AdminUser[]; roles: UserRole[] }
export interface CreateUserInput { name: string; password: string; roleCode?: UserRoleCode; roleId?: string }
export class UserApiError extends Error {
  constructor(public readonly status: number) { super('Não foi possível concluir a operação de usuários.'); }
}
export function isUserRoleCode(code: string): code is UserRoleCode {
  return ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN'].includes(code);
}
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function isRole(value: unknown): value is UserRole {
  return isObject(value) && typeof value.id === 'string' && typeof value.code === 'string' && typeof value.name === 'string' &&
    (value.permissions === undefined || (Array.isArray(value.permissions) && value.permissions.every((p) => typeof p === 'string'))) &&
    (value.protected === undefined || typeof value.protected === 'boolean');
}
function isUser(value: unknown): value is AdminUser {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.active === 'boolean' && Array.isArray(value.roles) && value.roles.every(isRole) &&
    (value.roleVersion === undefined || (Number.isSafeInteger(value.roleVersion) && Number(value.roleVersion) > 0)) &&
    (value.canReassign === undefined || typeof value.canReassign === 'boolean') &&
    (value.permissions === undefined || (Array.isArray(value.permissions) && value.permissions.every((p) => typeof p === 'string')));
}
function endpoint(apiBaseUrl: string) {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  if (!base) throw new UserApiError(503);
  return base + '/admin/users';
}
export async function loadUsers(apiBaseUrl: string): Promise<AdminUsers> {
  const response = await authenticatedFetch(endpoint(apiBaseUrl));
  if (!response.ok) throw new UserApiError(response.status);
  const value: unknown = await response.json();
  if (!isObject(value) || !Array.isArray(value.users) || !value.users.every(isUser) ||
    !Array.isArray(value.roles) || !value.roles.every(isRole)) {
    throw new UserApiError(502);
  }
  return { users: value.users, roles: value.roles as UserRole[] };
}
export async function createUser(apiBaseUrl: string, input: CreateUserInput): Promise<AdminUser> {
  const response = await authenticatedFetch(endpoint(apiBaseUrl), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, password: input.password, ...(input.roleId ? { roleId: input.roleId } : { roleCode: input.roleCode }) }),
  });
  if (!response.ok) throw new UserApiError(response.status);
  const value: unknown = await response.json();
  if (!isObject(value) || !isUser(value.user)) throw new UserApiError(502);
  return value.user;
}
export async function updateUserRole(apiBaseUrl: string, id: string, roleId: string, expectedVersion: number): Promise<AdminUser> {
  const response = await authenticatedFetch(`${endpoint(apiBaseUrl)}/${encodeURIComponent(id)}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId, expectedVersion }),
  });
  if (!response.ok) throw new UserApiError(response.status);
  const value: unknown = await response.json();
  if (!isObject(value) || !isUser(value.user)) throw new UserApiError(502);
  return value.user;
}
