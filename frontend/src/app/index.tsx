import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { MainMenuScreen } from '@/components/main-menu-screen';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  return (
    <>
      <StatusBar style="dark" />
      <MainMenuScreen
        canAccessCredits={hasPermission(user, 'credits.read')}
        canAccessStatements={hasPermission(user, 'statements.read')}
        canAccessTables={hasPermission(user, 'tables.read')}
        onCredits={() => {
          router.push('/credits' as Href);
        }}
        onStatements={() => {
          router.push('/statements' as Href);
        }}
        onTables={() => {
          router.push('/tables' as Href);
        }}
        onLogout={() => {
          void signOut();
        }}
        userName={user?.name}
      />
    </>
  );
}
