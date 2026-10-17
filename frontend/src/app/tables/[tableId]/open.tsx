import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { OpenComandaScreen } from '@/components/open-comanda-screen';

export default function OpenComandaRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { tableId, tableNumber } = useLocalSearchParams<{
    tableId?: string;
    tableNumber?: string;
  }>();

  return (
    <OpenComandaScreen
      onBack={safeBack}
      onOpened={(comanda) => {
        router.replace(
          `/comandas/${encodeURIComponent(comanda.id)}/products` as Href,
        );
      }}
      tableId={Number(tableId)}
      tableNumber={Number(tableNumber)}
    />
  );
}
