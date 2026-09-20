import { type Href, useRouter } from 'expo-router';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { QuickSalesScreen } from '@/components/quick-sales-screen';
import { Text } from 'react-native';

export default function QuickSalesRoute() {
  const router = useRouter();
  const { user } = useAuth();
  if (!hasPermission(user, 'comandas.read')) return <Text>Sem permissão para consultar comandas.</Text>;
  return <QuickSalesScreen canWrite={hasPermission(user, 'comandas.write')} onBack={() => router.back()}
    onSelect={(sale) => router.push(`/comandas/${encodeURIComponent(sale.id)}?origin=quick-sale` as Href)} />;
}
