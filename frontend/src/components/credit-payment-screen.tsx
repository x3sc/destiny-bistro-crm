import { useCallback, useState } from 'react';
import { useNavigationGuard } from '../navigation/safe-navigation';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import type { PaymentAllocationInput } from '../services/comandas-api';
import { loadCreditCustomer, settleCreditOrder, type CreditOrder } from '../services/credits-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import { CreditButton } from './credit-screen-parts';
import { creditStyles as styles } from './credit-screens.styles';
import { PaymentForm } from './payment-form';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'success'; order: CreditOrder };

export function CreditPaymentScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  customerId,
  loadRequest = loadCreditCustomer,
  onBack,
  onFinished,
  orderId,
  settleRequest = settleCreditOrder,
}: {
  apiBaseUrl?: string;
  customerId: string;
  loadRequest?: typeof loadCreditCustomer;
  onBack: () => void;
  onFinished: () => void;
  orderId: string;
  settleRequest?: typeof settleCreditOrder;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  useNavigationGuard({ busy: submitting });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) return setState({ kind: 'error' });
    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, customerId).then(
      (customer) => {
        const order = customer.orders.find((candidate) => candidate.id === orderId);
        setState(order?.status === 'OPEN' ? { kind: 'success', order } : { kind: 'error' });
      },
      () => setState({ kind: 'error' }),
    );
  }, [customerId, loadRequest, normalizedApiBaseUrl, orderId]);
  useFocusEffect(refresh);

  const submit = async (payments: PaymentAllocationInput[]) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success') return;
    setSubmitting(true);
    try {
      await settleRequest(normalizedApiBaseUrl, orderId, payments);
      onFinished();
    } catch {
      setSubmitting(false);
      setState({ kind: 'error' });
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <BrandedScreenHeader
        description={
          state.kind === 'success'
            ? `Comanda #${state.order.comandaNumber} · ${state.order.customerName}`
            : undefined
        }
        onBack={onBack}
        title="Registrar pagamento"
      />
      <ScrollView
        contentContainerStyle={styles.detailsContent}
        style={styles.scroll}
      >
        {state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.description}>Carregando saldo...</Text>
          </View>
        )}
        {state.kind === 'error' && (
          <View style={styles.actions}>
            <Text style={styles.error}>
              Não foi possível carregar ou registrar este pagamento.
            </Text>
            <CreditButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}
        {state.kind === 'success' && (
          <>
            <View style={styles.paymentHero}>
              <Text style={styles.summaryLabel}>Saldo a receber</Text>
              <Text fontRole="heading" style={styles.summaryValue}>
                {formatCentsAsBrl(state.order.balanceCents)}
              </Text>
              <Text style={styles.description}>
                Total {formatCentsAsBrl(state.order.totalCents)} · Já pago{' '}
                {formatCentsAsBrl(state.order.paidCents)}
              </Text>
            </View>
            <View style={styles.paymentSurface}>
              <PaymentForm
                allowZero={false}
                disabled={submitting}
                maxCents={state.order.balanceCents}
                onSubmit={(payments) => void submit(payments)}
                submitLabel={submitting ? 'Registrando...' : 'Registrar pagamento'}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
