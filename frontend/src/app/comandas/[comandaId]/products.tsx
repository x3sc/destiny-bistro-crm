import { useLocalSearchParams, useRouter } from 'expo-router';

import { ProductCatalogScreen } from '@/components/product-catalog-screen';

export default function ProductCatalogRoute() {
  const router = useRouter();
  const { comandaId = '' } = useLocalSearchParams<{
    comandaId?: string;
  }>();

  return (
    <ProductCatalogScreen
      comandaId={comandaId}
      onBack={() => {
        router.back();
      }}
    />
  );
}
