import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useRouter } from 'expo-router';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { QuickSalesScreen } from '@/components/quick-sales-screen';
import { Text } from 'react-native';

export default function QuickSalesRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { user } = useAuth();
  if (!hasPermission(user, 'quick-sales.read')) return <Text>Sem permissão para consultar comandas.</Text>;
  return <QuickSalesScreen canWrite={hasPermission(user, 'quick-sales.write')} onBack={safeBack}
    onSelect={(sale) => router.push(`/comandas/${encodeURIComponent(sale.id)}?origin=quick-sale` as Href)} />;
}
