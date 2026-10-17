import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export interface PermissionOption { code: string; name: string; group: string; dependencies: string[]; ownerOnly: boolean }
export interface AccessRole { id: string; code: string; name: string; description: string | null; protected: boolean; version: number; userCount: number;
  permissions: string[]; canEdit?: boolean; canDelete?: boolean }
export interface RolesData { roles: AccessRole[]; permissions: PermissionOption[] }
export interface RoleInput { name: string; description?: string | null; permissions: string[] }
export class RoleApiError extends Error { constructor(public readonly status: number) { super('Não foi possível atualizar os cargos.'); } }
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function isAccessRole(value: unknown): value is AccessRole {
  return object(value) && typeof value.id === 'string' && typeof value.code === 'string' && typeof value.name === 'string' &&
    (value.description === null || typeof value.description === 'string') && typeof value.protected === 'boolean' &&
    Number.isSafeInteger(value.version) && Number(value.version) > 0 && Number.isSafeInteger(value.userCount) && Number(value.userCount) >= 0 && strings(value.permissions) &&
    (value.canEdit === undefined || typeof value.canEdit === 'boolean') && (value.canDelete === undefined || typeof value.canDelete === 'boolean');
}
function endpoint(base: string) { const url = normalizeApiBaseUrl(base); if (!url) throw new RoleApiError(503); return `${url}/admin/roles`; }
export async function loadRoles(base: string): Promise<RolesData> {
  const response = await authenticatedFetch(endpoint(base));
  if (!response.ok) throw new RoleApiError(response.status);
  const data: unknown = await response.json();
  if (!object(data) || !Array.isArray(data.roles) || !data.roles.every(isAccessRole) || !Array.isArray(data.permissions) ||
    !data.permissions.every((option) => object(option) && typeof option.code === 'string' && typeof option.name === 'string' &&
      typeof option.group === 'string' && strings(option.dependencies) && typeof option.ownerOnly === 'boolean')) throw new RoleApiError(502);
  return data as unknown as RolesData;
}
export async function saveRole(base: string, input: RoleInput, role?: Pick<AccessRole, 'id' | 'version'>): Promise<AccessRole> {
  const response = await authenticatedFetch(`${endpoint(base)}${role ? `/${encodeURIComponent(role.id)}` : ''}`, {
    method: role ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name.trim(), description: input.description?.trim() || null, permissions: input.permissions,
      ...(role ? { expectedVersion: role.version } : {}) }),
  });
  if (!response.ok) throw new RoleApiError(response.status);
  const result: unknown = await response.json();
  if (!object(result) || !isAccessRole(result.role)) throw new RoleApiError(502);
  return result.role;
}
export async function deleteRole(base: string, role: Pick<AccessRole, 'id' | 'version'>) {
  const response = await authenticatedFetch(`${endpoint(base)}/${encodeURIComponent(role.id)}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: role.version }),
  });
  if (!response.ok) throw new RoleApiError(response.status);
}
export function setPermission(current: string[], code: string, enabled: boolean, catalog: PermissionOption[]): string[] {
  const next = new Set(current);
  if (enabled) {
    const visit = (key: string) => { if (next.has(key)) return; next.add(key); catalog.find((option) => option.code === key)?.dependencies.forEach(visit); };
    visit(code);
  } else {
    next.delete(code);
    let changed = true;
    while (changed) { changed = false; for (const option of catalog) {
      if (next.has(option.code) && option.dependencies.some((dependency) => !next.has(dependency))) { next.delete(option.code); changed = true; }
    } }
  }
  return [...next].sort();
}
export const permissionGroupNames: Record<string, string> = { comandas: 'Comandas de mesa', tables: 'Mesas', 'quick-sales': 'Venda Rápida', 'counter-sales': 'Balcão',
  credits: 'Fiados', deliveries: 'Delivery', products: 'Cardápio', inventory: 'Estoque', kitchen: 'Cozinha', printing: 'Impressão', statements: 'Extratos', roles: 'Cargos', users: 'Usuários' };
export function permissionDisplayName(code: string) {
  const special: Record<string, string> = { 'printing.write': 'Imprimir comandas e pedidos', 'users.manage': 'Gerenciar usuários',
    'roles.manage': 'Gerenciar cargos e permissões', 'inventory.write': 'Alterar estoque e autorizar estornos' };
  if (special[code]) return special[code];
  const [group, action] = code.split('.');
  return permissionGroupNames[group] && ['read', 'write'].includes(action) ? `${action === 'read' ? 'Visualizar' : 'Operar'} ${permissionGroupNames[group]}` : code;
}
