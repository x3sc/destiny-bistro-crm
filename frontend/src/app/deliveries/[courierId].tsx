import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { DeliveryCourierScreen } from '@/components/delivery-courier-screen';

export default function DeliveryCourierRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { courierId } = useLocalSearchParams<{ courierId: string }>();

  return (
    <DeliveryCourierScreen
      courierId={courierId}
      onBack={safeBack}
      onOpenDay={(dayId) => {
        router.push(`/deliveries/days/${encodeURIComponent(dayId)}` as Href);
      }}
    />
  );
}
