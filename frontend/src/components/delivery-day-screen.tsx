import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PaymentMethod } from '../services/comandas-api';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  closeDeliveryDay,
  loadDeliveryDay,
  recordDelivery,
  recordDeliveryExpense,
  type DeliveryDayDetails,
} from '../services/deliveries-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import {
  DeliveryButton,
  formatDateTime,
  MoneyField,
  paymentMethodLabels,
  PaymentMethodPicker,
  TextField,
  TotalRow,
} from './delivery-screen-parts';
import { deliveryStyles } from './delivery-screens.styles';

type State =
  | { day: DeliveryDayDetails; kind: 'success' }
  | { kind: 'error' }
  | { kind: 'loading' };

type FormKind = 'delivery' | 'expense' | null;

export function DeliveryDayScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  closeRequest = closeDeliveryDay,
  dayId,
  expenseRequest = recordDeliveryExpense,
  loadRequest = loadDeliveryDay,
  onBack,
  recordRequest = recordDelivery,
}: {
  apiBaseUrl?: string;
  closeRequest?: typeof closeDeliveryDay;
  dayId: string;
  expenseRequest?: typeof recordDeliveryExpense;
  loadRequest?: typeof loadDeliveryDay;
  onBack: () => void;
  recordRequest?: typeof recordDelivery;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [form, setForm] = useState<FormKind>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [products, setProducts] = useState('');
  const [totalCents, setTotalCents] = useState(0);
  const [feeCents, setFeeCents] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCents, setExpenseCents] = useState(0);

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setState({ kind: 'error' });
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, dayId).then(
      (day) => {
        setState({ day, kind: 'success' });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [dayId, loadRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const resetDeliveryForm = () => {
    setCustomerName('');
    setAddress('');
    setProducts('');
    setTotalCents(0);
    setFeeCents(0);
    setPaymentMethod('CASH');
  };

  const handleFailure = (fallback: string) => (error: unknown) => {
    setSaving(false);
    setFormError(error instanceof Error ? error.message : fallback);
  };

  const submitDelivery = () => {
    if (!normalizedApiBaseUrl || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);
    void recordRequest(normalizedApiBaseUrl, dayId, {
      address,
      customerName,
      feeCents,
      paymentMethod,
      products: products.trim() || null,
      totalCents,
    }).then((day) => {
      setSaving(false);
      setState({ day, kind: 'success' });
      resetDeliveryForm();
      setForm(null);
    }, handleFailure('Não foi possível registrar a entrega.'));
  };

  const submitExpense = () => {
    if (!normalizedApiBaseUrl || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);
    void expenseRequest(normalizedApiBaseUrl, dayId, {
      amountCents: expenseCents,
      description: expenseDescription,
    }).then((day) => {
      setSaving(false);
      setState({ day, kind: 'success' });
      setExpenseDescription('');
      setExpenseCents(0);
      setForm(null);
    }, handleFailure('Não foi possível registrar a despesa.'));
  };

  const closeDay = () => {
    if (!normalizedApiBaseUrl || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);
    void closeRequest(normalizedApiBaseUrl, dayId).then((day) => {
      setSaving(false);
      setState({ day, kind: 'success' });
    }, handleFailure('Não foi possível fechar o dia.'));
  };

  const day = state.kind === 'success' ? state.day : null;
  const isOpen = day?.status === 'OPEN';
  const deliveryValid =
    customerName.trim().length > 0 && address.trim().length > 0 && totalCents > 0;
  const expenseValid =
    expenseDescription.trim().length > 0 && expenseCents > 0;

  return (
    <SafeAreaView style={deliveryStyles.safeArea}>
      <BrandedScreenHeader
        description={day ? `Entregador: ${day.courierName}` : undefined}
        onBack={onBack}
        title="Dia de entregas"
      />
      <ScrollView
        contentContainerStyle={deliveryStyles.content}
        style={deliveryStyles.scroll}
      >
        {state.kind === 'loading' && (
          <View style={deliveryStyles.loading}>
            <ActivityIndicator
              color={themeColors.primaryActivity}
              size="large"
            />
            <Text style={deliveryStyles.description}>Carregando o dia...</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={deliveryStyles.actions}>
            <Text style={deliveryStyles.error}>
              Não foi possível carregar o dia.
            </Text>
            <DeliveryButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}

        {day ? (
          <>
            <View style={deliveryStyles.summaryCard}>
              <Text style={deliveryStyles.summaryLabel}>
                {isOpen ? 'A pagar ao entregador' : 'Pago ao entregador'}
              </Text>
              <Text style={deliveryStyles.summaryValue}>
                {formatCentsAsBrl(day.settlementPaidCents ?? day.payoutCents)}
              </Text>
              <View style={deliveryStyles.divider} />
              <TotalRow label="Diária" valueCents={day.dailyRateCents} />
              <TotalRow
                label={`Taxas de ${day.deliveryCount} ${
                  day.deliveryCount === 1 ? 'entrega' : 'entregas'
                }`}
                valueCents={day.feesTotalCents}
              />
              <TotalRow
                label="Despesas"
                negative={day.expensesTotalCents > 0}
                valueCents={day.expensesTotalCents}
              />
              <View style={deliveryStyles.divider} />
              <TotalRow
                emphasis
                label="Total"
                valueCents={day.settlementPaidCents ?? day.payoutCents}
              />
              <Text style={deliveryStyles.meta}>
                Vendido em entregas: {formatCentsAsBrl(day.salesTotalCents)}
              </Text>
            </View>

            {!isOpen && (
              <Text style={deliveryStyles.notice}>
                Dia fechado
                {day.closedAt ? ` em ${formatDateTime(day.closedAt)}` : ''}. O
                acerto já foi registrado.
              </Text>
            )}

            {isOpen && form === null && (
              <View style={deliveryStyles.actions}>
                <DeliveryButton
                  label="Registrar entrega"
                  onPress={() => {
                    setFormError(null);
                    setForm('delivery');
                  }}
                />
                <DeliveryButton
                  label="Registrar despesa"
                  onPress={() => {
                    setFormError(null);
                    setForm('expense');
                  }}
                  tone="secondary"
                />
              </View>
            )}

            {isOpen && form === 'delivery' && (
              <View style={deliveryStyles.formCard}>
                <Text style={deliveryStyles.sectionTitle}>Nova entrega</Text>
                <TextField
                  label="Nome do cliente"
                  onChangeText={setCustomerName}
                  placeholder="Ex.: Marina"
                  value={customerName}
                />
                <TextField
                  label="Endereço"
                  onChangeText={setAddress}
                  placeholder="Rua, número e complemento"
                  value={address}
                />
                <TextField
                  label="Produtos (opcional)"
                  onChangeText={setProducts}
                  placeholder="Ex.: 1 pizza + 2 refrigerantes"
                  value={products}
                />
                <MoneyField
                  label="Valor total da entrega"
                  onChangeCents={setTotalCents}
                  valueCents={totalCents}
                />
                <MoneyField
                  label="Taxa de entrega"
                  onChangeCents={setFeeCents}
                  valueCents={feeCents}
                />
                <Text style={deliveryStyles.meta}>
                  A taxa está incluída no total. O bistrô fica com{' '}
                  {formatCentsAsBrl(Math.max(totalCents - feeCents, 0))}.
                </Text>
                <PaymentMethodPicker
                  onSelect={setPaymentMethod}
                  selected={paymentMethod}
                />
                {formError ? (
                  <Text style={deliveryStyles.error}>{formError}</Text>
                ) : null}
                <DeliveryButton
                  disabled={!deliveryValid || saving}
                  label={saving ? 'Confirmando...' : 'Confirmar entrega'}
                  onPress={submitDelivery}
                />
                <DeliveryButton
                  label="Cancelar"
                  onPress={() => {
                    setForm(null);
                    setFormError(null);
                  }}
                  tone="secondary"
                />
              </View>
            )}

            {isOpen && form === 'expense' && (
              <View style={deliveryStyles.formCard}>
                <Text style={deliveryStyles.sectionTitle}>Nova despesa</Text>
                <Text style={deliveryStyles.description}>
                  Despesas são descontadas do valor a pagar ao entregador.
                </Text>
                <TextField
                  label="Descrição"
                  onChangeText={setExpenseDescription}
                  placeholder="Ex.: Gasolina"
                  value={expenseDescription}
                />
                <MoneyField
                  label="Valor"
                  onChangeCents={setExpenseCents}
                  valueCents={expenseCents}
                />
                {formError ? (
                  <Text style={deliveryStyles.error}>{formError}</Text>
                ) : null}
                <DeliveryButton
                  disabled={!expenseValid || saving}
                  label={saving ? 'Registrando...' : 'Registrar despesa'}
                  onPress={submitExpense}
                />
                <DeliveryButton
                  label="Cancelar"
                  onPress={() => {
                    setForm(null);
                    setFormError(null);
                  }}
                  tone="secondary"
                />
              </View>
            )}

            <View style={deliveryStyles.list}>
              <Text style={deliveryStyles.sectionTitle}>
                Entregas do dia ({day.deliveryCount})
              </Text>
              {day.deliveries.length === 0 ? (
                <Text style={deliveryStyles.empty}>
                  Nenhuma entrega registrada ainda.
                </Text>
              ) : (
                day.deliveries.map((delivery) => (
                  <View key={delivery.id} style={deliveryStyles.card}>
                    <View style={deliveryStyles.row}>
                      <Text style={deliveryStyles.cardTitle}>
                        {delivery.customerName}
                      </Text>
                      <Text style={deliveryStyles.badge}>
                        {paymentMethodLabels[delivery.paymentMethod]}
                      </Text>
                    </View>
                    <Text style={deliveryStyles.description}>
                      {delivery.address}
                    </Text>
                    {delivery.products ? (
                      <Text style={deliveryStyles.meta}>
                        {delivery.products}
                      </Text>
                    ) : null}
                    <View style={deliveryStyles.divider} />
                    <TotalRow label="Total" valueCents={delivery.totalCents} />
                    <TotalRow
                      label="Taxa do entregador"
                      valueCents={delivery.feeCents}
                    />
                    <Text style={deliveryStyles.meta}>
                      {formatDateTime(delivery.deliveredAt)}
                      {delivery.recordedBy
                        ? ` · ${delivery.recordedBy.name}`
                        : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {day.expenses.length > 0 && (
              <View style={deliveryStyles.list}>
                <Text style={deliveryStyles.sectionTitle}>Despesas</Text>
                {day.expenses.map((expense) => (
                  <View key={expense.id} style={deliveryStyles.card}>
                    <View style={deliveryStyles.row}>
                      <Text style={deliveryStyles.cardTitle}>
                        {expense.description}
                      </Text>
                      <Text style={deliveryStyles.totalValueNegative}>
                        {`- ${formatCentsAsBrl(expense.amountCents)}`}
                      </Text>
                    </View>
                    <Text style={deliveryStyles.meta}>
                      {formatDateTime(expense.createdAt)}
                      {expense.recordedBy
                        ? ` · ${expense.recordedBy.name}`
                        : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {isOpen && form === null && (
              <View style={deliveryStyles.actions}>
                <DeliveryButton
                  disabled={saving}
                  label={
                    saving
                      ? 'Fechando...'
                      : `Fechar dia e pagar ${formatCentsAsBrl(day.payoutCents)}`
                  }
                  onPress={closeDay}
                />
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
