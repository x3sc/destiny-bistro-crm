import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { Redirect, type Href, useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { NewDeliveryOrderScreen } from '@/components/new-delivery-order-screen';

export default function NewDeliveryOrderRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { user } = useAuth();
  if (
    !hasPermission(user, 'deliveries.write')
  ) {
    return <Redirect href="/deliveries" />;
  }
  return (
    <NewDeliveryOrderScreen
      onBack={safeBack}
      onCreated={(order) => {
        router.replace(
          `/deliveries/orders/${encodeURIComponent(order.id)}/products` as Href,
        );
      }}
    />
  );
}
