import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';

import { TableGridScreen } from '@/components/table-grid-screen';
import type { RestaurantTable } from '@/services/tables-api';

export default function HomeScreen() {
  const router = useRouter();

  const selectTable = (table: RestaurantTable) => {
    if (table.activeComanda) {
      router.push(`/comandas/${encodeURIComponent(table.activeComanda.id)}` as Href);
      return;
    }

    if (table.status === 'FREE') {
      router.push(`/tables/${table.id}/open?tableNumber=${table.number}` as Href);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <TableGridScreen onSelectTable={selectTable} />
    </>
  );
}
