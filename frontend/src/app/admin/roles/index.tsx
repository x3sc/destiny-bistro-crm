import { type Href, useRouter } from 'expo-router';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { RoleListScreen } from '@/components/role-management-screen';
import { useRouteSafeBack } from '@/navigation/safe-navigation';
export default function RolesRoute() {
  const { user } = useAuth(); const router = useRouter(); const back = useRouteSafeBack();
  return <RoleListScreen canManage={hasPermission(user, 'roles.manage')} onBack={back}
    onCreate={() => router.push('/admin/roles/new' as Href)} onEdit={(id) => router.push(`/admin/roles/${encodeURIComponent(id)}` as Href)} />;
}
