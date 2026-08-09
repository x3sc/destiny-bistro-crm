import { type Href, useRouter } from 'expo-router';

import { CreditCustomerPickerScreen } from '@/components/credit-customer-picker-screen';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { createCreditOrder } from '@/services/credits-api';

export default function NewCreditRoute() {
  const router = useRouter();

  return (
    <CreditCustomerPickerScreen
      actionLabel="Cadastrar e criar fiado"
      bottomNavigation={<AppBottomNavigation activeItem="credits" />}
      onBack={() => {
        router.back();
      }}
      onSelectCustomer={async (customer) => {
        const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
        const order = await createCreditOrder(apiBaseUrl, customer.id);
        router.replace(`/comandas/${encodeURIComponent(order.comandaId)}` as Href);
      }}
      title="Novo fiado"
    />
  );
}
