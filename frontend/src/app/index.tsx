import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';

import { MainMenuScreen } from '@/components/main-menu-screen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <>
      <StatusBar style="dark" />
      <MainMenuScreen
        onCredits={() => {
          router.push('/credits' as Href);
        }}
        onStatements={() => {
          router.push('/statements' as Href);
        }}
        onTables={() => {
          router.push('/tables' as Href);
        }}
      />
    </>
  );
}
