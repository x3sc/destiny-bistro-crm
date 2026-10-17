import { useRouteSafeBack } from '@/navigation/safe-navigation';

import { MenuManagementScreen } from '@/components/menu-management-screen';

export default function MenuManagementRoute() {
  const safeBack = useRouteSafeBack();

  return <MenuManagementScreen onBack={safeBack} />;
}
