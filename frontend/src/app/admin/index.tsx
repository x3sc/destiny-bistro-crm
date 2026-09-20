import { type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { AdminHomeScreen } from '@/components/admin-home-screen';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { canManageMenu, canManageUsers } from '@/services/authorization';

export default function AdminRoute() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <AdminHomeScreen
      bottomNavigation={<AppBottomNavigation activeItem="admin" />}
      canManageMenu={canManageMenu(user)}
      canManageUsers={canManageUsers(user)}
      onUsers={() => router.push('/admin/users' as Href)}
      canReadInventory={hasPermission(user, 'inventory.read')}
      canReadStatements={hasPermission(user, 'statements.read')}
      onBack={() => router.replace('/')}
      onMenu={() => router.push('/admin/menu' as Href)}
      onInventory={() => router.push('/admin/inventory' as Href)}
      onStatement={() => router.push('/admin/statements' as Href)}
    />
  );
}
