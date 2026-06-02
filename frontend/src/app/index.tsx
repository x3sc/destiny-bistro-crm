import { StatusBar } from 'expo-status-bar';

import { TableGridScreen } from '@/components/table-grid-screen';

export default function HomeScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <TableGridScreen />
    </>
  );
}
