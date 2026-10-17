import { useLocalSearchParams } from 'expo-router';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { RoleEditorScreen } from '@/components/role-management-screen';
import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';
export default function EditRoleRoute() {
  const { roleId = '' } = useLocalSearchParams<{ roleId?: string }>();
  const { user } = useAuth(); const back = useRouteSafeBack(); const finish = useCompletedFlowNavigation();
  return <RoleEditorScreen roleId={roleId} canManage={hasPermission(user, 'roles.manage')} onBack={back} onSaved={() => finish({ kind: 'roles' })} />;
}
