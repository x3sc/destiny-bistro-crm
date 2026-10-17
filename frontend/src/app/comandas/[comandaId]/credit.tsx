import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { CreditCustomerPickerScreen } from '@/components/credit-customer-picker-screen';
import { convertComandaToCredit } from '@/services/credits-api';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';

export default function ConvertComandaCreditRoute() {
  const safeBack = useRouteSafeBack();
  const finishFlow = useCompletedFlowNavigation();
  const { user } = useAuth();
  const { comandaId = '', name = '' } = useLocalSearchParams<{
    comandaId?: string;
    name?: string;
  }>();

  if (!hasPermission(user, 'credits.write')) return <Redirect href="/" />;

  return (
    <CreditCustomerPickerScreen
      actionLabel="Cadastrar e fechar como fiado"
      initialName={name}
      onBack={safeBack}
      onSelectCustomer={async (customer) => {
        await convertComandaToCredit(
          process.env.EXPO_PUBLIC_API_URL ?? '',
          comandaId,
          customer.id,
        );
        finishFlow({ kind: 'credit', customerId: customer.id });
      }}
      title="Fechar como fiado"
    />
  );
}
