import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { ComandaCheckoutScreen } from '@/components/comanda-checkout-screen';

export default function ComandaCheckoutRoute() {
  const router = useRouter();
  const { comandaId = '' } = useLocalSearchParams<{ comandaId?: string }>();
  return (
    <ComandaCheckoutScreen
      comandaId={comandaId}
      onBack={() => router.back()}
      onFinished={(customerId) => {
        router.replace(
          (customerId ? `/credits/${encodeURIComponent(customerId)}` : '/tables') as Href,
        );
      }}
    />
  );
}
