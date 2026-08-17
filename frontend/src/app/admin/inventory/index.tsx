import { type Href, useRouter } from 'expo-router';

import { InventoryManagementScreen } from '@/components/inventory-management-screen';

export default function InventoryRoute() {
  const router = useRouter();
  return <InventoryManagementScreen onBack={() => router.replace('/admin' as Href)} />;
}
