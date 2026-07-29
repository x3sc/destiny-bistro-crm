import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { CreditCustomerPickerScreen } from '@/components/credit-customer-picker-screen';
import { convertComandaToCredit } from '@/services/credits-api';

export default function ConvertComandaCreditRoute() {
  const router = useRouter();
  const { comandaId = '', name = '' } = useLocalSearchParams<{
    comandaId?: string;
    name?: string;
  }>();

  return (
    <CreditCustomerPickerScreen
      actionLabel="Cadastrar e fechar como fiado"
      initialName={name}
      onBack={() => {
        router.back();
      }}
      onSelectCustomer={async (customer) => {
        await convertComandaToCredit(
          process.env.EXPO_PUBLIC_API_URL ?? '',
          comandaId,
          customer.id,
        );
        router.replace(`/credits/${encodeURIComponent(customer.id)}` as Href);
      }}
      title="Fechar como fiado"
    />
  );
}
