import { Redirect, type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { DeliveryOrderComandaLoader } from '@/components/delivery-order-comanda-loader';
import { ProductCatalogScreen } from '@/components/product-catalog-screen';

export default function DeliveryOrderProductsRoute() {
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
      title="Cardápio do pedido"
    >
      {(comandaId) => (
        <ProductCatalogScreen
          comandaId={comandaId}
          onBack={() => {
            router.replace(
              `/deliveries/orders/${encodeURIComponent(orderId)}` as Href,
            );
          }}
        />
      )}
    </DeliveryOrderComandaLoader>
  );
}
