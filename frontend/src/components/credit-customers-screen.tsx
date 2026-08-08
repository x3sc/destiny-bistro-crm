import { type ReactNode, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  loadCreditCustomers,
  type CreditCustomerSummary,
} from '../services/credits-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { CreditButton } from './credit-screen-parts';
import { creditStyles } from './credit-screens.styles';
import { BrandedScreenHeader } from './branded-screen-header';

type State =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { customers: CreditCustomerSummary[]; kind: 'success' };

export function CreditCustomersScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  bottomNavigation,
  loadRequest = loadCreditCustomers,
  onBack,
  onNewCredit,
  onSelectCustomer,
}: {
  apiBaseUrl?: string;
  bottomNavigation?: ReactNode;
  loadRequest?: typeof loadCreditCustomers;
  onBack: () => void;
  onNewCredit: () => void;
  onSelectCustomer: (customer: CreditCustomerSummary) => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<State>({ kind: 'loading' });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setState({ kind: 'error' });
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl).then(
      (customers) => {
        setState({ customers, kind: 'success' });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [loadRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const totalBalanceCents =
    state.kind === 'success'
      ? state.customers.reduce((total, customer) => total + customer.balanceCents, 0)
      : 0;

  return (
    <SafeAreaView style={creditStyles.safeArea}>
      <BrandedScreenHeader
        description="Saldos em aberto e pedidos que ainda estão sendo montados"
        onBack={onBack}
        title="Fiados"
      />
      <ScrollView
        contentContainerStyle={creditStyles.content}
        style={creditStyles.scroll}
      >
        {state.kind === 'success' && (
          <View style={creditStyles.summaryCard}>
            <Text style={creditStyles.summaryLabel}>Total em aberto</Text>
            <Text style={creditStyles.summaryValue}>
              {formatCentsAsBrl(totalBalanceCents)}
            </Text>
            <Text style={creditStyles.summaryCount}>
              {state.customers.length}{' '}
              {state.customers.length === 1 ? 'cliente' : 'clientes'}
            </Text>
          </View>
        )}

        <View style={creditStyles.actions}>
          <CreditButton label="Adicionar um novo fiado" onPress={onNewCredit} />
        </View>

        {state.kind === 'loading' && (
          <View style={creditStyles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={creditStyles.description}>Carregando fiados...</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={creditStyles.actions}>
            <Text style={creditStyles.error}>
              Não foi possível carregar os fiados.
            </Text>
            <CreditButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}

        {state.kind === 'success' && state.customers.length === 0 && (
          <Text style={creditStyles.empty}>
            Nenhum saldo ou rascunho de fiado no momento.
          </Text>
        )}

        {state.kind === 'success' && state.customers.length > 0 && (
          <View style={creditStyles.list}>
            <Text style={creditStyles.sectionTitle}>Fiados recentes</Text>
            {state.customers.map((customer) => (
              <Pressable
                accessibilityRole="button"
                key={customer.id}
                onPress={() => {
                  onSelectCustomer(customer);
                }}
                style={({ pressed }) => [
                  creditStyles.card,
                  pressed && creditStyles.cardPressed,
                ]}
              >
                <View style={creditStyles.row}>
                  <Text style={creditStyles.cardTitle}>{customer.name}</Text>
                  <Text style={creditStyles.balance}>
                    {formatCentsAsBrl(customer.balanceCents)}
                  </Text>
                </View>
                <Text style={creditStyles.description}>
                  {customer.openOrderCount}{' '}
                  {customer.openOrderCount === 1 ? 'pedido aberto' : 'pedidos abertos'}
                </Text>
                {customer.draftOrderCount > 0 && (
                  <Text style={creditStyles.badge}>
                    {customer.draftOrderCount}{' '}
                    {customer.draftOrderCount === 1 ? 'rascunho' : 'rascunhos'}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      {bottomNavigation}
    </SafeAreaView>
  );
}
