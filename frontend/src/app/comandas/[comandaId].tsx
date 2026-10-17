import { useRouteSafeBack } from '@/navigation/safe-navigation';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { ComandaDetailsScreen } from '@/components/comanda-details-screen';
import { hasPermission, useAuth } from '@/auth/auth-context';
import { hasComandaPermission, hasAnyComandaPermission } from '@/services/authorization';
import { useCompletedFlowNavigation } from '@/navigation/use-completed-flow-navigation';

export default function ComandaDetailsRoute() {
  const router = useRouter();
  const safeBack = useRouteSafeBack();
  const finishFlow = useCompletedFlowNavigation();
  const { user } = useAuth();
  const { comandaId = '', origin, warnings } = useLocalSearchParams<{
    comandaId?: string;
    origin?: string;
    warnings?: string;
  }>();

  return (
    <ComandaDetailsScreen
      canOperate={(comanda) => hasComandaPermission(user, comanda, 'write')}
      canPrint={hasPermission(user, 'printing.write')}
      canCancelConfirmed={
        hasAnyComandaPermission(user, 'write') &&
        hasPermission(user, 'inventory.write')
      }
      comandaId={comandaId}
      initialInventoryWarnings={parseInventoryWarnings(warnings)}
      onAddProducts={(id) => {
        router.push(`/comandas/${encodeURIComponent(id)}/products${origin === 'quick-sale' ? '?origin=quick-sale' : ''}` as Href);
      }}
      onBack={safeBack}
      onCancelled={() => {
        finishFlow({ kind: origin === 'quick-sale' ? 'quick-sales' : 'tables' });
      }}
      onCheckout={(comanda) => {
        router.push(`/comandas/${encodeURIComponent(comanda.id)}/checkout${origin === 'quick-sale' ? '?origin=quick-sale' : ''}` as Href);
      }}
      onCreditFinished={(customerId) => {
        finishFlow({ kind: 'credit', customerId });
      }}
      readOnly={!hasAnyComandaPermission(user, 'write')}
    />
  );
}

function parseInventoryWarnings(value: string | undefined) {
  if (!value || value.length > 8_000) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (warning) =>
            warning &&
            typeof warning === 'object' &&
            ('type' in warning) &&
            (warning.type === 'INSUFFICIENT_STOCK' ||
              warning.type === 'MISSING_RECIPE'),
        )
      : [];
  } catch {
    return [];
  }
}
