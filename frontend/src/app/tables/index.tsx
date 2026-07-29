import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';

import { TableGridScreen } from '@/components/table-grid-screen';
import { hasPermission, useAuth } from '@/auth/auth-context';
import type { RestaurantTable } from '@/services/tables-api';

export default function TablesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'comandas.write');

  const selectTable = (table: RestaurantTable) => {
    if (table.activeComanda) {
      router.push(`/comandas/${encodeURIComponent(table.activeComanda.id)}` as Href);
      return;
    }

    if (table.status === 'FREE' && canWrite) {
      router.push(`/tables/${table.id}/open?tableNumber=${table.number}` as Href);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <TableGridScreen
        onBack={() => {
          router.replace('/');
        }}
        onSelectTable={selectTable}
      />
    </>
  );
}
