import { useNavigationGuard } from '../navigation/safe-navigation';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import type { PaymentMethod } from '../services/comandas-api';
import {
  cancelCreditOrder,
  loadCreditCustomer,
  type CreditCustomerDetails,
  type CreditOrder,
} from '../services/credits-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { CreditButton } from './credit-screen-parts';
import { creditStyles } from './credit-screens.styles';
import { BrandedScreenHeader } from './branded-screen-header';

type State =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { customer: CreditCustomerDetails; kind: 'success' };

const statusLabels: Record<CreditOrder['status'], string> = {
  CANCELLED: 'Cancelado',
  DRAFT: 'Rascunho',
  OPEN: 'Em aberto',
  SETTLED: 'Quitado',
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  COUNTER: 'Balcão (caixa externo)',
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'Pix',
};

export function CreditCustomerDetailsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  cancelRequest = cancelCreditOrder,
  customerId,
  loadRequest = loadCreditCustomer,
  onBack,
  onNewCredit,
  onViewOrder,
  onPayOrder,
}: {
  apiBaseUrl?: string;
  cancelRequest?: typeof cancelCreditOrder;
  customerId: string;
  loadRequest?: typeof loadCreditCustomer;
  onBack: () => void;
  onNewCredit: (customerId: string) => void;
  onPayOrder?: (order: CreditOrder) => void;
  onViewOrder: (order: CreditOrder) => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [isMutating, setIsMutating] = useState(false);
  useNavigationGuard({ busy: isMutating });
  const [mutationError, setMutationError] = useState(false);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'SETTLED'>('OPEN');

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !customerId) {
      setState({ kind: 'error' });
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, customerId).then(
      (customer) => {
        setState({ customer, kind: 'success' });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [customerId, loadRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const reloadCustomer = async () => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    const customer = await loadRequest(normalizedApiBaseUrl, customerId);
    setState({ customer, kind: 'success' });
  };

  const cancelDraft = async (order: CreditOrder) => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    setIsMutating(true);
    setMutationError(false);

    try {
      await cancelRequest(normalizedApiBaseUrl, order.id);
      await reloadCustomer();
    } catch {
      setMutationError(true);
    } finally {
      setIsMutating(false);
    }
  };

  const visibleOrders =
    state.kind === 'success'
      ? state.customer.orders.filter((order) =>
          statusFilter === 'OPEN'
            ? order.status === 'DRAFT' || order.status === 'OPEN'
            : order.status === 'SETTLED',
        )
      : [];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={creditStyles.safeArea}>
      <BrandedScreenHeader
        description={
          state.kind === 'success' ? `Cliente: ${state.customer.name}` : undefined
        }
        onBack={onBack}
        title="Detalhes do fiado"
      />
      <ScrollView
        contentContainerStyle={creditStyles.detailsContent}
        style={creditStyles.scroll}
      >

        {state.kind === 'loading' && (
          <View style={creditStyles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
          </View>
        )}

        {state.kind === 'error' && (
          <View style={creditStyles.actions}>
            <Text style={creditStyles.error}>
              Não foi possível carregar este fiado.
            </Text>
            <CreditButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}

        {state.kind === 'success' && (
          <>
            {mutationError && (
              <Text style={creditStyles.error}>
                Não foi possível concluir esta operação.
              </Text>
            )}

            <CreditButton
              disabled={isMutating}
              label="Novo fiado"
              onPress={() => {
                onNewCredit(customerId);
              }}
            />

            <View style={creditStyles.debtSummaryCard}>
              <Text style={creditStyles.summaryLabel}>Saldo devedor total</Text>
              <Text fontRole="heading" style={creditStyles.summaryValue}>
                {formatCentsAsBrl(state.customer.balanceCents)}
              </Text>
              <Text style={creditStyles.summaryRecordCount}>
                {state.customer.openOrderCount + state.customer.draftOrderCount}{' '}
                registros
              </Text>
              <View style={creditStyles.summaryMetrics}>
                <View style={creditStyles.summaryMetric}>
                  <Text style={creditStyles.summaryMetricLabel}>Em aberto</Text>
                  <Text fontRole="heading" style={creditStyles.summaryMetricValue}>
                    {state.customer.openOrderCount}
                  </Text>
                </View>
                <View style={creditStyles.summaryMetric}>
                  <Text style={creditStyles.summaryMetricLabel}>Rascunhos</Text>
                  <Text fontRole="heading" style={creditStyles.summaryMetricValue}>
                    {state.customer.draftOrderCount}
                  </Text>
                </View>
              </View>
            </View>

            <View style={creditStyles.filterRow}>
              <View style={creditStyles.filterOption}>
                <CreditButton
                  label="Em aberto"
                  onPress={() => {
                    setStatusFilter('OPEN');
                  }}
                  tone={statusFilter === 'OPEN' ? 'primary' : 'secondary'}
                />
              </View>
              <View style={creditStyles.filterOption}>
                <CreditButton
                  label="Quitados"
                  onPress={() => {
                    setStatusFilter('SETTLED');
                  }}
                  tone={statusFilter === 'SETTLED' ? 'primary' : 'secondary'}
                />
              </View>
            </View>

            {visibleOrders.length === 0 && (
              <Text style={creditStyles.empty}>
                {statusFilter === 'OPEN'
                  ? 'Nenhum fiado em aberto.'
                  : 'Nenhum fiado quitado.'}
              </Text>
            )}

            <View style={creditStyles.list}>
              {visibleOrders.map((order) => (
                <View key={order.id} style={creditStyles.orderCard}>
                  <View style={creditStyles.row}>
                    <Text fontRole="heading" style={creditStyles.orderTitle}>
                      Comanda #{order.comandaNumber}
                    </Text>
                    <Text style={creditStyles.badge}>
                      {statusLabels[order.status]}
                    </Text>
                  </View>
                  <Text style={creditStyles.orderMeta}>
                    {order.source === 'TABLE'
                      ? `Mesa ${order.tableNumber ?? '-'}`
                      : order.source === 'QUICK_SALE'
                        ? 'Venda rápida'
                        : order.source === 'DELIVERY'
                        ? 'Pedido delivery'
                        : 'Lançamento manual'}
                  </Text>
                  <Text style={creditStyles.orderMeta}>
                    {formatDateTime(order.orderedAt)}
                  </Text>
                  <View style={creditStyles.financialSummary}>
                    <View style={creditStyles.financialRow}>
                      <Text style={creditStyles.financialLabel}>Total da comanda</Text>
                      <Text style={creditStyles.financialValue}>
                        {formatCentsAsBrl(order.totalCents)}
                      </Text>
                    </View>
                    <View style={creditStyles.financialRow}>
                      <Text style={creditStyles.financialLabel}>Valor já pago</Text>
                      <Text style={creditStyles.financialValue}>
                        {formatCentsAsBrl(order.paidCents)}
                      </Text>
                    </View>
                    <View style={creditStyles.financialDivider} />
                    <View style={creditStyles.financialRow}>
                      <Text style={creditStyles.remainingLabel}>Saldo restante</Text>
                      <Text fontRole="heading" style={creditStyles.remainingValue}>
                        {formatCentsAsBrl(order.balanceCents)}
                      </Text>
                    </View>
                  </View>
                  {order.payments.map((payment) => (
                    <View key={payment.id} style={creditStyles.paymentCard}>
                      <Text style={creditStyles.cardTitle}>
                        Recebimento {formatCentsAsBrl(payment.amountCents)}
                      </Text>
                      {payment.allocations.length === 0 ? (
                        <Text style={creditStyles.orderMeta}>
                          Forma de pagamento não informada
                        </Text>
                      ) : (
                        payment.allocations.map((allocation) => (
                          <Text key={allocation.id} style={creditStyles.orderMeta}>
                            {paymentMethodLabels[allocation.method]} ·{' '}
                            {formatCentsAsBrl(allocation.amountCents)}
                          </Text>
                        ))
                      )}
                      <Text style={creditStyles.orderMeta}>
                        {formatDateTime(payment.paidAt)} ·{' '}
                        {payment.recordedBy?.name ?? 'Operador não informado'}
                      </Text>
                    </View>
                  ))}

                  <View style={creditStyles.actions}>
                    <CreditButton
                      disabled={isMutating}
                      label={
                        order.status === 'DRAFT'
                          ? 'Retomar rascunho'
                          : 'Visualizar comanda'
                      }
                      onPress={() => {
                        onViewOrder(order);
                      }}
                      tone="secondary"
                    />

                    {order.status === 'DRAFT' && (
                      <CreditButton
                        disabled={isMutating}
                        label="Cancelar rascunho"
                        onPress={() => {
                          confirmAction(
                            'Cancelar rascunho',
                            'Deseja cancelar este rascunho de fiado?',
                            () => {
                              void cancelDraft(order);
                            },
                          );
                        }}
                        tone="danger"
                      />
                    )}

                    {order.status === 'OPEN' && (
                      <>
                        {order.hasPendingItems && (
                          <Text style={creditStyles.notice}>
                            Confirme os itens novos na comanda antes de quitar.
                          </Text>
                        )}
                        <CreditButton
                          disabled={isMutating || order.hasPendingItems}
                          label={`Registrar pagamento (${formatCentsAsBrl(order.balanceCents)})`}
                          onPress={() => {
                            onPayOrder?.(order);
                          }}
                        />
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    const confirm = (globalThis as typeof globalThis & {
      confirm?: (text?: string) => boolean;
    }).confirm;

    if (confirm?.(message)) {
      onConfirm();
    }

    return;
  }

  Alert.alert(title, message, [
    { style: 'cancel', text: 'Voltar' },
    { onPress: onConfirm, text: 'Confirmar' },
  ]);
}
