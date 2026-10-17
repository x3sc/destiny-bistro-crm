import { useRouteSafeBack } from '@/navigation/safe-navigation';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { KitchenScreen } from '@/components/kitchen-screen';

export default function KitchenRoute() {
  const safeBack = useRouteSafeBack();
  const { user } = useAuth();

  return (
    <KitchenScreen
      canWrite={hasPermission(user, 'kitchen.write')}
      onBack={safeBack}
    />
  );
}
