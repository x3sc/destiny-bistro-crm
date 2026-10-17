import type { AuthUser } from './auth-api';

export function canManageMenu(user: AuthUser | null) {
  return Boolean(
    user &&
      user.permissions.includes('products.write'),
  );
}

export function canManageUsers(user: AuthUser | null) {
  return Boolean(user && user.permissions.includes('users.manage'));
}

export function hasAppPermission(user: AuthUser | null, permission: string): boolean {
  if (!user?.permissions?.includes(permission)) return false;
  return true;
}

export function hasComandaPermission(user: AuthUser | null, comanda: import('./comandas-api').Comanda, mode: 'read' | 'write') {
  const origin = comanda.operationalOrigin ?? (comanda.credit ? 'CREDIT' : comanda.tableName === 'Balcão' ? 'COUNTER' :
    comanda.tableName === 'Venda rápida' ? 'QUICK_SALE' : 'TABLE');
  const scopes = { TABLE: 'comandas', QUICK_SALE: 'quick-sales', COUNTER: 'counter-sales', CREDIT: 'credits', DELIVERY: 'deliveries' };
  return hasAppPermission(user, `${scopes[origin]}.${mode}`);
}
export function hasAnyComandaPermission(user: AuthUser | null, mode: 'read' | 'write') {
  return ['comandas', 'quick-sales', 'counter-sales', 'credits', 'deliveries'].some((scope) => hasAppPermission(user, `${scope}.${mode}`));
}
