import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { CounterSalesScreen } from '@/components/counter-sales-screen';

export default function CounterSalesRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { user } = useAuth();
  if (!hasPermission(user, 'counter-sales.read')) return <Text>Sem permissão para consultar o Balcão.</Text>;
  return <CounterSalesScreen canWrite={hasPermission(user, 'counter-sales.write')}
    onBack={safeBack}
    onOpened={(sale) => router.push(`/comandas/${encodeURIComponent(sale.id)}/products?origin=counter` as Href)}
    onSelect={(sale) => router.push(`/counter-sales/${encodeURIComponent(sale.id)}` as Href)} />;
}
