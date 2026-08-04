import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { MainMenuScreen } from '@/components/main-menu-screen';
import { canManageMenu } from '@/services/authorization';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  return (
    <>
      <StatusBar style="dark" />
      <MainMenuScreen
        canAccessAdmin={
          canManageMenu(user) || hasPermission(user, 'statements.read')
        }
        canAccessCredits={hasPermission(user, 'credits.read')}
        canAccessTables={hasPermission(user, 'tables.read')}
        establishmentName={user?.establishment.name}
        onAdmin={() => {
          router.push('/admin' as Href);
        }}
        onCredits={() => {
          router.push('/credits' as Href);
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
