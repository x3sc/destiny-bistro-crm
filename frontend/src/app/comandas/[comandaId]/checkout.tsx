import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { hasComandaPermission } from '@/services/authorization';
import { useLocalSearchParams } from 'expo-router';

import { ComandaCheckoutScreen } from '@/components/comanda-checkout-screen';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';

export default function ComandaCheckoutRoute() {
  const safeBack = useRouteSafeBack();
  const finishFlow = useCompletedFlowNavigation();
  const { user } = useAuth();
  const { comandaId = '', origin } = useLocalSearchParams<{ comandaId?: string; origin?: string }>();
  return (
    <ComandaCheckoutScreen
      canOperate={(comanda) => hasComandaPermission(user, comanda, 'write')}
      canCreateCredit={hasPermission(user, 'credits.write')}
      canPrint={hasPermission(user, 'printing.write')}
      comandaId={comandaId}
      onBack={safeBack}
      onFinished={(customerId) => {
        finishFlow(customerId ? { kind: 'credit', customerId } : { kind: origin === 'quick-sale' ? 'quick-sales' : 'tables' });
      }}
    />
  );
}
