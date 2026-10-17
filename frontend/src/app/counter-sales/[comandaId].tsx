import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { CounterSaleDetailsScreen } from '@/components/counter-sale-details-screen';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';

export default function CounterSaleDetailsRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const finish = useCompletedFlowNavigation();
  const { user } = useAuth();
  const { comandaId = '' } = useLocalSearchParams<{ comandaId?: string }>();
  if (!hasPermission(user, 'counter-sales.read')) return <Text>Sem permissão para consultar o Balcão.</Text>;
  return <CounterSaleDetailsScreen comandaId={comandaId} canWrite={hasPermission(user, 'counter-sales.write')}
    canCancelConfirmed={hasPermission(user, 'counter-sales.write') && hasPermission(user, 'inventory.write')}
    canPrint={hasPermission(user, 'printing.write')}
    onBack={safeBack} onFinished={() => finish({ kind: 'counter' })}
    onAddProducts={(id) => router.push(`/comandas/${encodeURIComponent(id)}/products?origin=counter` as Href)} />;
}
