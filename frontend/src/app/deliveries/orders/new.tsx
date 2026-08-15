import { Redirect, type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { NewDeliveryOrderScreen } from '@/components/new-delivery-order-screen';

export default function NewDeliveryOrderRoute() {
  const router = useRouter();
  const { user } = useAuth();
  if (
    !hasPermission(user, 'deliveries.write') ||
    !hasPermission(user, 'comandas.write')
  ) {
    return <Redirect href="/deliveries" />;
  }
  return (
    <NewDeliveryOrderScreen
      onBack={() => router.back()}
      onCreated={(order) => {
        router.replace(
          `/deliveries/orders/${encodeURIComponent(order.id)}/products` as Href,
        );
      }}
    />
  );
}
