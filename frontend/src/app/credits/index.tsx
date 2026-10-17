import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useRouter } from 'expo-router';

import { CreditCustomersScreen } from '@/components/credit-customers-screen';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';

export default function CreditsRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();

  return (
    <CreditCustomersScreen
      bottomNavigation={<AppBottomNavigation activeItem="credits" />}
      onBack={safeBack}
      onNewCredit={() => {
        router.push('/credits/new' as Href);
      }}
      onSelectCustomer={(customer) => {
        router.push(`/credits/${encodeURIComponent(customer.id)}` as Href);
      }}
    />
  );
}
