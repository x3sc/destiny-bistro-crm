import { useRouteSafeBack } from '@/navigation/safe-navigation';

import { InventoryManagementScreen } from '@/components/inventory-management-screen';

export default function InventoryRoute() {
  const safeBack = useRouteSafeBack();
  return <InventoryManagementScreen onBack={safeBack} />;
}
