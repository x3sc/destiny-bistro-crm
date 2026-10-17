import { useRouteSafeBack } from '@/navigation/safe-navigation';

import { StatementsScreen } from '@/components/statements-screen';

export default function DailyStatementRoute() {
  const safeBack = useRouteSafeBack();

  return (
    <StatementsScreen
      onBack={safeBack}
      title="Extrato do dia"
    />
  );
}
