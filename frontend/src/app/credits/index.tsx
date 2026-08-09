import { type Href, useRouter } from 'expo-router';

import { CreditCustomersScreen } from '@/components/credit-customers-screen';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';

export default function CreditsRoute() {
  const router = useRouter();

  return (
    <CreditCustomersScreen
      bottomNavigation={<AppBottomNavigation activeItem="credits" />}
      onBack={() => {
        router.replace('/');
      }}
      onNewCredit={() => {
        router.push('/credits/new' as Href);
      }}
      onSelectCustomer={(customer) => {
        router.push(`/credits/${encodeURIComponent(customer.id)}` as Href);
      }}
    />
  );
}
