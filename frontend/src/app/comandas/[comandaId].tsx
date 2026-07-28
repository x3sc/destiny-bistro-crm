import { useLocalSearchParams, useRouter } from 'expo-router';

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
        router.replace('/');
      }}
      onClosed={() => {
        router.replace('/');
      }}
    />
  );
}
