import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import { closeComanda, loadComanda, type Comanda, type PaymentAllocationInput } from '../services/comandas-api';
import { createCreditCustomer, loadCreditCustomers, type CreditCustomerSummary } from '../services/credits-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { creditStyles as styles } from './credit-screens.styles';
import { CreditButton } from './credit-screen-parts';
import { PaymentForm } from './payment-form';
import { ScreenBackButton } from './screen-back-button';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { comanda: Comanda; customers: CreditCustomerSummary[]; kind: 'success' };

export function ComandaCheckoutScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  closeRequest = closeComanda,
  comandaId,
  createCustomerRequest = createCreditCustomer,
  loadComandaRequest = loadComanda,
  loadCustomersRequest = loadCreditCustomers,
  entityLabel = 'mesa',
  headingTitle = 'Fechar mesa',
  onBack,
  onFinished,
}: {
  apiBaseUrl?: string;
  closeRequest?: typeof closeComanda;
  comandaId: string;
  createCustomerRequest?: typeof createCreditCustomer;
  loadComandaRequest?: typeof loadComanda;
  loadCustomersRequest?: typeof loadCreditCustomers;
  entityLabel?: 'mesa' | 'pedido';
  headingTitle?: string;
  onBack: () => void;
  onFinished: (customerId?: string) => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [payments, setPayments] = useState<PaymentAllocationInput[]>([]);
  const [paidCents, setPaidCents] = useState(0);
  const [paymentsValid, setPaymentsValid] = useState(true);
  const [customerId, setCustomerId] = useState<string>();
  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchVisible, setCustomerSearchVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      setState({ kind: 'error' });
      return;
    }
    setState({ kind: 'loading' });
    void Promise.all([
      loadComandaRequest(normalizedApiBaseUrl, comandaId),
      loadCustomersRequest(normalizedApiBaseUrl, true).catch(() => []),
    ]).then(
      ([comanda, customers]) => {
        setNewName(comanda.name ?? '');
        setState({ comanda, customers, kind: 'success' });
      },
      () => setState({ kind: 'error' }),
    );
  }, [comandaId, loadComandaRequest, loadCustomersRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const submit = async (selectedCustomerId = customerId) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success') return;
    const needsCredit = paidCents < state.comanda.totalCents;
    if (needsCredit && !selectedCustomerId) {
      setSubmitError(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(false);
    try {
      const comanda = await closeRequest(
        normalizedApiBaseUrl,
        comandaId,
        payments,
        needsCredit ? selectedCustomerId : undefined,
      );
      onFinished(comanda.credit?.customerId);
    } catch {
      setSubmitError(true);
      setSubmitting(false);
    }
  };

  const openCreditCustomers =
    state.kind === 'success'
      ? state.customers.filter(customerHasOpenCredit)
      : [];
  const normalizedCustomerSearch = normalizeCustomerSearch(customerSearchQuery);
  const filteredCreditCustomers = openCreditCustomers.filter((customer) =>
    normalizeCustomerSearch(customer.name).includes(normalizedCustomerSearch),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenBackButton onPress={onBack} />
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>{headingTitle}</Text>
          {state.kind === 'success' && (
            <Text style={styles.description}>
              Comanda #{state.comanda.number} · Total {formatCentsAsBrl(state.comanda.totalCents)}
            </Text>
          )}
        </View>

        {state.kind === 'loading' && <ActivityIndicator color={themeColors.primaryActivity} />}
        {state.kind === 'error' && <Text style={styles.error}>Não foi possível carregar o fechamento.</Text>}

        {state.kind === 'success' && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pagamento</Text>
              <PaymentForm
                allowZero
                disabled={submitting}
                maxCents={state.comanda.totalCents}
                onPaymentChange={(summary) => {
                  setPaidCents(summary.totalCents);
                  setPayments(summary.payments);
                  setPaymentsValid(summary.valid);
                }}
              />
            </View>

            <CreditButton
              disabled={submitting || !paymentsValid}
              label={
                submitting
                  ? 'Processando...'
                  : paidCents === state.comanda.totalCents
                    ? `Confirmar e fechar ${entityLabel}`
                    : paidCents === 0
                      ? 'Fechar como fiado'
                      : 'Confirmar e deixar saldo em fiado'
              }
              onPress={() => {
                if (paidCents < state.comanda.totalCents) {
                  setSubmitError(false);
                  setCustomerSearchQuery('');
                  setCustomerSearchVisible(false);
                  setCreditModalVisible(true);
                } else {
                  void submit();
                }
              }}
            />
          </>
        )}

        {submitError && <Text style={styles.error}>Confira os valores e selecione a pessoa responsável.</Text>}
      </ScrollView>

      {state.kind === 'success' && (
        <Modal
          animationType="fade"
          onRequestClose={() => setCreditModalVisible(false)}
          transparent
          visible={creditModalVisible}
        >
          <View style={modalStyles.backdrop}>
            <View style={modalStyles.sheet}>
              <Text style={styles.sectionTitle}>Selecionar fiado</Text>
              <Text style={styles.description}>
                O saldo de{' '}
                {formatCentsAsBrl(state.comanda.totalCents - paidCents)} ficará em
                aberto para a pessoa escolhida.
              </Text>

              <CreditButton
                label={
                  customerSearchVisible
                    ? 'Criar novo fiado'
                    : 'Buscar cadastrados'
                }
                onPress={() => {
                  setCustomerSearchQuery('');
                  setCustomerSearchVisible((visible) => !visible);
                }}
                tone="secondary"
              />

              {customerSearchVisible ? (
                <View style={modalStyles.searchSection}>
                  <TextInput
                    accessibilityLabel="Buscar pessoa cadastrada"
                    autoCapitalize="words"
                    onChangeText={setCustomerSearchQuery}
                    placeholder="Digite o nome"
                    style={styles.field}
                    value={customerSearchQuery}
                  />
                  <ScrollView
                    contentContainerStyle={modalStyles.listContent}
                    keyboardShouldPersistTaps="handled"
                    style={modalStyles.list}
                  >
                    {openCreditCustomers.length === 0 && (
                      <Text style={styles.empty}>
                        Nenhum cadastro com fiado em aberto.
                      </Text>
                    )}
                    {openCreditCustomers.length > 0 &&
                      filteredCreditCustomers.length === 0 && (
                        <Text style={styles.empty}>
                          Nenhuma pessoa encontrada.
                        </Text>
                      )}
                    {filteredCreditCustomers.map((customer) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: customerId === customer.id,
                        }}
                        key={customer.id}
                        onPress={() => setCustomerId(customer.id)}
                        style={({ pressed }) => [
                          styles.card,
                          customerId === customer.id &&
                            modalStyles.selectedCustomer,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <Text style={styles.cardTitle}>{customer.name}</Text>
                        <Text style={styles.orderMeta}>
                          Saldo atual {formatCentsAsBrl(customer.balanceCents)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={modalStyles.newCredit}>
                  <Text style={styles.cardTitle}>Criar novo fiado</Text>
                  <TextInput
                    accessibilityLabel="Nome da pessoa"
                    editable={!submitting}
                    onChangeText={setNewName}
                    placeholder="Nome"
                    style={styles.field}
                    value={newName}
                  />
                  <CreditButton
                    disabled={submitting || !newName.trim()}
                    label={
                      submitting ? 'Cadastrando...' : 'Cadastrar novo fiado'
                    }
                    onPress={() => {
                      if (!normalizedApiBaseUrl) return;
                      setSubmitting(true);
                      setSubmitError(false);
                      void createCustomerRequest(
                        normalizedApiBaseUrl,
                        newName,
                      ).then(
                        (customer) => {
                          setCustomerId(customer.id);
                          setState((current) =>
                            current.kind === 'success'
                              ? {
                                  ...current,
                                  customers: [...current.customers, customer],
                                }
                              : current,
                          );
                          setSubmitting(false);
                        },
                        () => {
                          setSubmitError(true);
                          setSubmitting(false);
                        },
                      );
                    }}
                  />
                </View>
              )}

              {submitError && (
                <Text style={styles.error}>
                  Não foi possível cadastrar ou selecionar este fiado.
                </Text>
              )}
              <View style={modalStyles.actions}>
                <View style={modalStyles.action}>
                  <CreditButton
                    label="Cancelar"
                    onPress={() => setCreditModalVisible(false)}
                    tone="secondary"
                  />
                </View>
                <View style={modalStyles.action}>
                  <CreditButton
                    disabled={submitting || !customerId}
                    label="Confirmar fiado"
                    onPress={() => {
                      setCreditModalVisible(false);
                      void submit(customerId);
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 22, 16, 0.48)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  list: { maxHeight: 230 },
  listContent: { gap: 10 },
  newCredit: { gap: 10 },
  selectedCustomer: {
    borderColor: themeColors.primary,
    borderWidth: 2,
  },
  searchSection: { gap: 10 },
  sheet: {
    backgroundColor: themeColors.background,
    borderRadius: 18,
    gap: 14,
    maxWidth: 560,
    padding: 20,
    width: '100%',
  },
});

function customerHasOpenCredit(customer: CreditCustomerSummary) {
  return customer.balanceCents > 0;
}

function normalizeCustomerSearch(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR');
}
