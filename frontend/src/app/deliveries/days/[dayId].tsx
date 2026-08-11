import { useLocalSearchParams, useRouter } from 'expo-router';

import { DeliveryDayScreen } from '@/components/delivery-day-screen';

export default function DeliveryDayRoute() {
  const router = useRouter();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();

  return (
    <DeliveryDayScreen
      dayId={dayId}
      onBack={() => {
        router.back();
      }}
    />
  );
}
