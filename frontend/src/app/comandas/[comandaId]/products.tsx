import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { useAuth } from '@/auth/auth-context';
import { hasComandaPermission } from '@/services/authorization';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { ProductCatalogScreen } from '@/components/product-catalog-screen';

export default function ProductCatalogRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const { user } = useAuth();
  const { comandaId = '', origin } = useLocalSearchParams<{
    comandaId?: string;
    origin?: string;
  }>();

  return (
    <ProductCatalogScreen
      canOperate={(comanda) => hasComandaPermission(user, comanda, 'write')}
      comandaId={comandaId}
      onBack={safeBack}
      onAdded={(comanda) => {
        router.replace(
          (origin === 'counter' ? `/counter-sales/${encodeURIComponent(comanda.id)}` : `/comandas/${encodeURIComponent(comanda.id)}${origin === 'quick-sale' ? '?origin=quick-sale' : ''}`) as Href,
        );
      }}
    />
  );
}
