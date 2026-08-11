import { type Href, useRouter } from 'expo-router';

import { DeliveryCouriersScreen } from '@/components/delivery-couriers-screen';

export default function DeliveriesRoute() {
  const router = useRouter();

  return (
    <DeliveryCouriersScreen
      onBack={() => {
        router.replace('/');
      }}
      onSelectCourier={(courier) => {
        router.push(`/deliveries/${encodeURIComponent(courier.id)}` as Href);
      }}
    />
  );
}
