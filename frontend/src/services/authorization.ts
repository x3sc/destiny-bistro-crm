import type { AuthUser } from './auth-api';

export function canManageMenu(user: AuthUser | null) {
  return Boolean(
    user &&
      (user.permissions.includes('products.write') ||
        user.roles.some(({ code }) => code === 'OWNER' || code === 'MANAGER')),
  );
}
