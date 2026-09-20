import { useRouter } from 'expo-router';

import { hasPermission, useAuth } from '@/auth/auth-context';
import { KitchenScreen } from '@/components/kitchen-screen';

export default function KitchenRoute() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <KitchenScreen
      canWrite={hasPermission(user, 'kitchen.write')}
      onBack={() => router.replace('/')}
    />
  );
}
