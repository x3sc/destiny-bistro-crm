import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { CreditPaymentScreen } from '@/components/credit-payment-screen';

export default function CreditPaymentRoute() {
  const router = useRouter();
  const { customerId = '', orderId = '' } = useLocalSearchParams<{
    customerId?: string;
    orderId?: string;
  }>();
  return (
    <CreditPaymentScreen
      customerId={customerId}
      onBack={() => router.back()}
      onFinished={() => router.replace(`/credits/${encodeURIComponent(customerId)}` as Href)}
      orderId={orderId}
    />
  );
}
