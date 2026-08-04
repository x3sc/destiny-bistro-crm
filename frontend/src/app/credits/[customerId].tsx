import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { CreditCustomerDetailsScreen } from '@/components/credit-customer-details-screen';
import { createCreditOrder } from '@/services/credits-api';

export default function CreditDetailsRoute() {
  const router = useRouter();
  const { customerId = '' } = useLocalSearchParams<{
    customerId?: string;
  }>();

  return (
    <CreditCustomerDetailsScreen
      customerId={customerId}
      onBack={() => {
        router.replace('/credits' as Href);
      }}
      onNewCredit={(id) => {
        void createCreditOrder(process.env.EXPO_PUBLIC_API_URL ?? '', id).then(
          (order) => {
            router.push(
              `/comandas/${encodeURIComponent(order.comandaId)}` as Href,
            );
          },
        );
      }}
      onPayOrder={(order) => {
        router.push(
          `/credits/${encodeURIComponent(customerId)}/orders/${encodeURIComponent(order.id)}/payment` as Href,
        );
      }}
      onViewOrder={(order) => {
        router.push(`/comandas/${encodeURIComponent(order.comandaId)}` as Href);
      }}
    />
  );
}
