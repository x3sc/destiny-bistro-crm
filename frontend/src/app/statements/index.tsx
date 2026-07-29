import { useRouter } from 'expo-router';

import { StatementsScreen } from '@/components/statements-screen';

export default function StatementsRoute() {
  const router = useRouter();

  return (
    <StatementsScreen
      onBack={() => {
        router.replace('/');
      }}
    />
  );
}
