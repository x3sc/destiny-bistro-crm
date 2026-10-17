import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { Redirect, type Href, useRouter } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { UserManagementScreen } from '@/components/user-management-screen';
import { canManageUsers } from '@/services/authorization';

export default function UsersRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { user } = useAuth();
  if (!user || !canManageUsers(user)) return <Redirect href={'/admin' as Href} />;
  return <UserManagementScreen key={user.id + user.establishment.id} canManageUsers
    bottomNavigation={<AppBottomNavigation activeItem="admin" />}
    onBack={safeBack} onEditRole={(id) => router.push(`/admin/users/${encodeURIComponent(id)}/role` as Href)} />;
}
