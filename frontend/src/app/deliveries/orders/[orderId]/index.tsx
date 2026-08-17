import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { DeliveryOrderDetailsScreen } from '@/components/delivery-order-details-screen';

export default function DeliveryOrderRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const { orderId = '' } = useLocalSearchParams<{ orderId?: string }>();

  return (
    <DeliveryOrderDetailsScreen
      onAddProducts={() => {
        router.push(
          `/deliveries/orders/${encodeURIComponent(orderId)}/products` as Href,
        );
      }}
      onBack={() => router.replace('/deliveries' as Href)}
      onCheckout={() => {
        router.push(
          `/deliveries/orders/${encodeURIComponent(orderId)}/checkout` as Href,
        );
      }}
      orderId={orderId}
      readOnly={
        !hasPermission(user, 'deliveries.write') ||
        !hasPermission(user, 'comandas.write')
      }
    />
  );
}
