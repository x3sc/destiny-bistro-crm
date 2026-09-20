import { Redirect, type Href, useRouter } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { UserManagementScreen } from '@/components/user-management-screen';
import { canManageUsers } from '@/services/authorization';

export default function UsersRoute() {
  const router = useRouter();
  const { user } = useAuth();
  if (!user || !canManageUsers(user)) return <Redirect href={'/admin' as Href} />;
  return <UserManagementScreen key={user.id + user.establishment.id} canManageUsers
    bottomNavigation={<AppBottomNavigation activeItem="admin" />}
    onBack={() => router.replace('/admin' as Href)} />;
}
