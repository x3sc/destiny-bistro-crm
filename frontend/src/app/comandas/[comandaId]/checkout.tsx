import { hasPermission, useAuth } from '@/auth/auth-context';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { ComandaCheckoutScreen } from '@/components/comanda-checkout-screen';

export default function ComandaCheckoutRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const { comandaId = '', origin } = useLocalSearchParams<{ comandaId?: string; origin?: string }>();
  return (
    <ComandaCheckoutScreen
      canCreateCredit={hasPermission(user, 'credits.write')}
      comandaId={comandaId}
      onBack={() => router.back()}
      onFinished={(customerId) => {
        router.replace(
          (customerId ? `/credits/${encodeURIComponent(customerId)}` : origin === 'quick-sale' ? '/quick-sales' : '/tables') as Href,
        );
      }}
    />
  );
}
