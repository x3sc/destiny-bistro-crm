import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { OpenComandaScreen } from '@/components/open-comanda-screen';

export default function OpenComandaRoute() {
  const router = useRouter();
  const { tableId, tableNumber } = useLocalSearchParams<{
    tableId?: string;
    tableNumber?: string;
  }>();

  return (
    <OpenComandaScreen
      onBack={() => {
        router.back();
      }}
      onOpened={(comanda) => {
        router.replace(`/comandas/${encodeURIComponent(comanda.id)}` as Href);
      }}
      tableId={Number(tableId)}
      tableNumber={Number(tableNumber)}
    />
  );
}
