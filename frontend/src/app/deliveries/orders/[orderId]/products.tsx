import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { DeliveryOrderComandaLoader } from '@/components/delivery-order-comanda-loader';
import { ProductCatalogScreen } from '@/components/product-catalog-screen';

export default function DeliveryOrderProductsRoute() {
  const safeBack = useRouteSafeBack();
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
      title="Cardápio do pedido"
    >
      {(comandaId) => (
        <ProductCatalogScreen
          comandaId={comandaId}
          onBack={safeBack}
        />
      )}
    </DeliveryOrderComandaLoader>
  );
}
