import { Redirect, type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { ComandaCheckoutScreen } from '@/components/comanda-checkout-screen';
import { DeliveryOrderComandaLoader } from '@/components/delivery-order-comanda-loader';

export default function DeliveryOrderCheckoutRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const { orderId = '' } = useLocalSearchParams<{ orderId?: string }>();
  if (
    !hasPermission(user, 'deliveries.write') ||
    !hasPermission(user, 'comandas.write')
  ) {
    return <Redirect href="/deliveries" />;
  }

  return (
    <DeliveryOrderComandaLoader
      onBack={() => router.back()}
      orderId={orderId}
      title="Pagamento do pedido"
    >
      {(comandaId) => (
        <ComandaCheckoutScreen
          comandaId={comandaId}
          entityLabel="pedido"
          headingTitle="Pagamento do pedido"
          onBack={() => router.back()}
          onFinished={() => {
            router.replace(
              `/deliveries/orders/${encodeURIComponent(orderId)}` as Href,
            );
          }}
        />
      )}
    </DeliveryOrderComandaLoader>
  );
}
