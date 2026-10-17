import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { ComandaCheckoutScreen } from '@/components/comanda-checkout-screen';
import { DeliveryOrderComandaLoader } from '@/components/delivery-order-comanda-loader';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';

export default function DeliveryOrderCheckoutRoute() {
  const safeBack = useRouteSafeBack();
  const finishFlow = useCompletedFlowNavigation();
  const { user } = useAuth();
  const { orderId = '' } = useLocalSearchParams<{ orderId?: string }>();
  if (
    !hasPermission(user, 'deliveries.write')
  ) {
    return <Redirect href="/deliveries" />;
  }

  return (
    <DeliveryOrderComandaLoader
      onBack={safeBack}
      orderId={orderId}
      title="Pagamento do pedido"
    >
      {(comandaId) => (
        <ComandaCheckoutScreen
          canCreateCredit={hasPermission(user, 'credits.write')}
          comandaId={comandaId}
          entityLabel="pedido"
          headingTitle="Pagamento do pedido"
          onBack={safeBack}
          onFinished={() => {
            finishFlow({ kind: 'delivery', orderId });
          }}
        />
      )}
    </DeliveryOrderComandaLoader>
  );
}
