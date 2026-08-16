import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { ComandaDetailsScreen } from '@/components/comanda-details-screen';
import { hasPermission, useAuth } from '@/auth/auth-context';

export default function ComandaDetailsRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const { comandaId = '' } = useLocalSearchParams<{
    comandaId?: string;
  }>();

  return (
    <ComandaDetailsScreen
      canCancelConfirmed={
        hasPermission(user, 'comandas.write') &&
        hasPermission(user, 'inventory.write')
      }
      comandaId={comandaId}
      onAddProducts={(id) => {
        router.push(`/comandas/${encodeURIComponent(id)}/products`);
      }}
      onBack={() => {
        router.back();
      }}
      onCancelled={() => {
        router.replace('/tables' as Href);
      }}
      onCheckout={(comanda) => {
        router.push(`/comandas/${encodeURIComponent(comanda.id)}/checkout` as Href);
      }}
      onCreditFinished={(customerId) => {
        router.replace(`/credits/${encodeURIComponent(customerId)}` as Href);
      }}
      readOnly={!hasPermission(user, 'comandas.write')}
    />
  );
}
