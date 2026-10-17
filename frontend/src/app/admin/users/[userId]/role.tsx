import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/auth-context';
import { canManageUsers } from '@/services/authorization';
import { UserRoleAssignmentScreen } from '@/components/user-role-assignment-screen';
import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';
export default function UserRoleRoute() {
  const { userId = '' } = useLocalSearchParams<{ userId?: string }>();
  const { user } = useAuth(); const back = useRouteSafeBack(); const finish = useCompletedFlowNavigation();
  return <UserRoleAssignmentScreen userId={userId} canManage={canManageUsers(user)} onBack={back} onSaved={() => finish({ kind: 'users' })} />;
}
