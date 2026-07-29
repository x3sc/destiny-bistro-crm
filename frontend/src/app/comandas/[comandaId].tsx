import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { ComandaDetailsScreen } from '@/components/comanda-details-screen';

export default function ComandaDetailsRoute() {
  const router = useRouter();
  const { comandaId = '' } = useLocalSearchParams<{
    comandaId?: string;
  }>();

  return (
    <ComandaDetailsScreen
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
      onCloseAsCredit={(comanda) => {
        const name = comanda.name
          ? `?name=${encodeURIComponent(comanda.name)}`
          : '';
        router.push(
          `/comandas/${encodeURIComponent(comanda.id)}/credit${name}` as Href,
        );
      }}
      onClosed={() => {
        router.replace('/tables' as Href);
      }}
      onCreditFinished={(customerId) => {
        router.replace(`/credits/${encodeURIComponent(customerId)}` as Href);
      }}
    />
  );
}
