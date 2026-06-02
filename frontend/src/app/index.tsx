import { StatusBar } from 'expo-status-bar';

import { ConnectivityScreen } from '@/components/connectivity-screen';

export default function HomeScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <ConnectivityScreen />
    </>
  );
}
