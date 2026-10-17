import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { OperationalMainMenuScreen } from '@/components/operational-main-menu-screen';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { canManageMenu } from '@/services/authorization';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  return (
    <>
      <StatusBar style="dark" />
      <OperationalMainMenuScreen
        bottomNavigation={<AppBottomNavigation activeItem="home" />}
        canAccessAdmin={
          canManageMenu(user) || hasPermission(user, 'statements.read') || hasPermission(user, 'inventory.read') || hasPermission(user, 'users.manage') || hasPermission(user, 'roles.manage')
        }
        canAccessCredits={hasPermission(user, 'credits.read')}
        canAccessDeliveries={hasPermission(user, 'deliveries.read')}
        canAccessKitchen={hasPermission(user, 'kitchen.read')}
        canAccessTables={hasPermission(user, 'tables.read')}
        canAccessQuickSales={hasPermission(user, 'quick-sales.read')}
        canAccessCounterSales={hasPermission(user, 'counter-sales.read')}
        onCounterSales={() => router.push('/counter-sales' as Href)}
        canReadSales={hasPermission(user, 'statements.read')}
        onQuickSales={() => router.push('/quick-sales' as Href)}
        establishmentName={user?.establishment.name}
        onAdmin={() => {
          router.push('/admin' as Href);
        }}
        onCredits={() => {
          router.push('/credits' as Href);
        }}
        onDeliveries={() => {
          router.push('/deliveries' as Href);
        }}
        onKitchen={() => {
          router.push('/kitchen' as Href);
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
