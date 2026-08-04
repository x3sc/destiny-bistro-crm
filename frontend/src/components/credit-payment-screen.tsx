import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import type { PaymentAllocationInput } from '../services/comandas-api';
import { loadCreditCustomer, settleCreditOrder, type CreditOrder } from '../services/credits-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { creditStyles as styles } from './credit-screens.styles';
import { PaymentForm } from './payment-form';
import { ScreenBackButton } from './screen-back-button';

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenBackButton onPress={onBack} />
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>Registrar pagamento</Text>
          {state.kind === 'success' && (
            <Text style={styles.description}>
              Comanda #{state.order.comandaNumber} · Saldo {formatCentsAsBrl(state.order.balanceCents)}
            </Text>
          )}
        </View>
        {state.kind === 'loading' && <ActivityIndicator color={themeColors.primaryActivity} />}
        {state.kind === 'error' && <Text style={styles.error}>Não foi possível registrar o pagamento.</Text>}
        {state.kind === 'success' && (
          <View style={styles.card}>
            <PaymentForm
              allowZero={false}
              disabled={submitting}
              maxCents={state.order.balanceCents}
              onSubmit={(payments) => void submit(payments)}
              submitLabel={submitting ? 'Registrando...' : 'Registrar pagamento'}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
