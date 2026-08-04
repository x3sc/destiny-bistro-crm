import { type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { AdminHomeScreen } from '@/components/admin-home-screen';
import { canManageMenu } from '@/services/authorization';

export default function AdminRoute() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <AdminHomeScreen
      canManageMenu={canManageMenu(user)}
      canReadStatements={hasPermission(user, 'statements.read')}
      onBack={() => router.replace('/')}
      onMenu={() => router.push('/admin/menu' as Href)}
      onStatement={() => router.push('/admin/statements' as Href)}
    />
  );
}
