import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { useLocalSearchParams } from 'expo-router';

import { CreditPaymentScreen } from '@/components/credit-payment-screen';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';

export default function CreditPaymentRoute() {
  const safeBack = useRouteSafeBack();
  const finishFlow = useCompletedFlowNavigation();
  const { customerId = '', orderId = '' } = useLocalSearchParams<{
    customerId?: string;
    orderId?: string;
  }>();
  return (
    <CreditPaymentScreen
      customerId={customerId}
      onBack={safeBack}
      onFinished={() => finishFlow({ kind: 'credit', customerId })}
      orderId={orderId}
    />
  );
}
