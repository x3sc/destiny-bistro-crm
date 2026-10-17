import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useRouter } from 'expo-router';

import { DeliveryCouriersScreen } from '@/components/delivery-couriers-screen';

export default function DeliveryCouriersRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  return (
    <DeliveryCouriersScreen
      onBack={safeBack}
      onOrders={() => router.replace('/deliveries' as Href)}
      onSelectCourier={(courier) => {
        router.push(`/deliveries/${encodeURIComponent(courier.id)}` as Href);
      }}
    />
  );
}
