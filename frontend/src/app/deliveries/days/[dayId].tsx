import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { useLocalSearchParams } from 'expo-router';

import { DeliveryDayScreen } from '@/components/delivery-day-screen';

export default function DeliveryDayRoute() {
  const safeBack = useRouteSafeBack();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();

  return (
    <DeliveryDayScreen
      dayId={dayId}
      onBack={safeBack}
    />
  );
}
