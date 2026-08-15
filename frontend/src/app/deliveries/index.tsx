import { type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { DeliveryOrdersScreen } from '@/components/delivery-orders-screen';

export default function DeliveriesRoute() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <DeliveryOrdersScreen
      canWrite={
        hasPermission(user, 'deliveries.write') &&
        hasPermission(user, 'comandas.write')
      }
      onBack={() => {
        router.replace('/');
      }}
      onCouriers={() => {
        router.push('/deliveries/couriers' as Href);
      }}
      onNewOrder={() => {
        router.push('/deliveries/orders/new' as Href);
      }}
      onSelectOrder={(order) => {
        router.push(`/deliveries/orders/${encodeURIComponent(order.id)}` as Href);
      }}
    />
  );
}
