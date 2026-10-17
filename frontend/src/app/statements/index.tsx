import { useRouteSafeBack } from '@/navigation/safe-navigation';

import { StatementsScreen } from '@/components/statements-screen';

export default function StatementsRoute() {
  const safeBack = useRouteSafeBack();

  return (
    <StatementsScreen
      onBack={safeBack}
    />
  );
}
