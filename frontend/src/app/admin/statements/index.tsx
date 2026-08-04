import { type Href, useRouter } from 'expo-router';

import { StatementsScreen } from '@/components/statements-screen';

export default function DailyStatementRoute() {
  const router = useRouter();

  return (
    <StatementsScreen
      onBack={() => router.replace('/admin' as Href)}
      title="Extrato do dia"
    />
  );
}
