import type { AuthUser } from './auth-api';

export function canManageMenu(user: AuthUser | null) {
  return Boolean(
    user &&
      (user.permissions.includes('products.write') ||
        user.roles.some(({ code }) => code === 'OWNER' || code === 'MANAGER')),
  );
}

export function canManageUsers(user: AuthUser | null) {
  return Boolean(user && user.permissions.includes('users.manage') &&
    user.roles.some(({ code }) => code === 'OWNER'));
}

export function hasAppPermission(user: AuthUser | null, permission: string): boolean {
  if (!user?.permissions.includes(permission)) return false;
  if (permission === 'credits.read' || permission === 'credits.write') {
    return user.roles.some(({ code }) => code === 'OWNER' || code === 'MANAGER');
  }
  return true;
}
