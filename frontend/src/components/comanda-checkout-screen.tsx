import { useCallback, useRef, useState } from 'react';
import { comandaNavigationResource, useNavigationGuard, useSafeBack } from '../navigation/safe-navigation';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import { closeComanda, CheckoutApiError, type Comanda, type PaymentAllocationInput } from '../services/comandas-api';
import { loadCheckoutSummary, type CheckoutSummaryResponse } from '../services/checkout-api';
import { counterRequestId } from '../services/counter-sales-api';
import { createCreditCustomer, loadCreditCustomers, type CreditCustomerSummary } from '../services/credits-api';
import { formatCentsAsBrl } from '../services/money';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import { creditStyles as styles } from './credit-screens.styles';
import { CreditButton } from './credit-screen-parts';
import { PaymentForm, type PaymentSummary } from './payment-form';
import { CheckoutSummary, CheckoutTotal } from './checkout-summary';
import { ServiceFeeBreakdown, ServiceFeeChoice } from './service-fee-breakdown';
import { ThermalPrintSection } from './thermal-print-section';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { comanda: Comanda; quote: CheckoutSummaryResponse; customers: CreditCustomerSummary[]; kind: 'success' };

export function ComandaCheckoutScreen({
  canOperate = () => true,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  closeRequest = closeComanda,
  canCreateCredit = false,
  canPrint = false,
  comandaId,
  createCustomerRequest = createCreditCustomer,
  loadSummaryRequest = loadCheckoutSummary,
  loadCustomersRequest = loadCreditCustomers,
  entityLabel = 'mesa',
  headingTitle = 'Fechar comanda',
  onBack,
  onFinished,
}: {
  canOperate?: (comanda: Comanda) => boolean;
  apiBaseUrl?: string;
  closeRequest?: typeof closeComanda;
  canCreateCredit?: boolean;
  canPrint?: boolean;
  comandaId: string;
  createCustomerRequest?: typeof createCreditCustomer;
  loadSummaryRequest?: typeof loadCheckoutSummary;
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
  const [includeServiceFee, setIncludeServiceFee] = useState(true);
  const [printedChoice, setPrintedChoice] = useState<boolean | null>(null);
  const [conflict, setConflict] = useState(false);
  const pendingSubmission = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const totalCents = state.kind === 'success' ? (state.quote.eligible && includeServiceFee ? state.quote.totalWithServiceFeeCents : state.quote.totalWithoutServiceFeeCents) : 0;
  const displayComanda = state.kind === 'success' ? { ...state.comanda, totalCents } : null;
  const handlePaymentChange = useCallback((summary: PaymentSummary) => {
    setPaidCents(summary.totalCents); setPayments(summary.payments); setPaymentsValid(summary.valid);
  }, []);
  const submissionLock = useRef(false);
  const modalBack = useSafeBack(() => { if (!submissionLock.current) setCreditModalVisible(false); });
  useNavigationGuard({ busy: submitting, dirty: paidCents > 0 || !includeServiceFee,
    resource: state.kind === 'success' ? comandaNavigationResource(state.comanda) : undefined,
    closeModal: creditModalVisible ? () => { setCreditModalVisible(false); setCustomerSearchVisible(false); } : undefined,
  });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      setState({ kind: 'error' });
      return;
    }
    setState({ kind: 'loading' });
    void Promise.all([
      loadSummaryRequest(normalizedApiBaseUrl, comandaId),
      canCreateCredit ? loadCustomersRequest(normalizedApiBaseUrl, true).catch(() => []) : Promise.resolve([]),
    ]).then(
      ([quote, customers]) => {
        const comanda = quote.comanda;
        setIncludeServiceFee(true); setPrintedChoice(null); setConflict(false); pendingSubmission.current = null;
        setPaidCents(0);
        setPayments([]);
        setPaymentsValid(true);
        setSubmitError(false);
        setCustomerId(undefined);
        setCreditModalVisible(false);
        setNewName(comanda.name ?? '');
        setState({ comanda, quote, customers, kind: 'success' });
      },
      () => setState({ kind: 'error' }),
    );
  }, [canCreateCredit, comandaId, loadSummaryRequest, loadCustomersRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const submit = async (selectedCustomerId = customerId) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success' || state.comanda.status !== 'OPEN' ||
      submissionLock.current || submitting || conflict || !state.quote.canClose || !paymentsValid || paidCents > totalCents || !canOperate(state.comanda)) return;
    const needsCredit = paidCents < totalCents;
    if (needsCredit && (!canCreateCredit || !selectedCustomerId)) {
      setSubmitError(true);
      return;
    }
    submissionLock.current = true;
    setSubmitting(true);
    setSubmitError(false);
    const selectedFee = state.quote.eligible && includeServiceFee;
    const fingerprint = JSON.stringify({ payments, selectedCustomerId, selectedFee, snapshot: state.quote.expectedSnapshot });
    if (pendingSubmission.current?.fingerprint !== fingerprint) pendingSubmission.current = { fingerprint, requestId: counterRequestId() };
    try {
      const comanda = await closeRequest(
        normalizedApiBaseUrl,
        comandaId,
        payments,
        needsCredit ? selectedCustomerId : undefined,
        { includeServiceFee: selectedFee, expectedSnapshot: state.quote.expectedSnapshot, requestId: pendingSubmission.current.requestId },
      );
      onFinished(comanda.credit?.customerId);
    } catch (failure) {
      if (failure instanceof CheckoutApiError && failure.status === 409) setConflict(true);
      submissionLock.current = false;
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
  const remainingCents =
    state.kind === 'success'
      ? Math.max(totalCents - paidCents, 0)
      : 0;
  const selectedCustomer =
    state.kind === 'success'
      ? state.customers.find((customer) => customer.id === customerId)
      : undefined;
  const readOnly = state.kind === 'success' && (state.comanda.status !== 'OPEN' || !canOperate(state.comanda));
  const invalidPayment = !paymentsValid || paidCents > totalCents;
  const primaryActionLabel =
    state.kind !== 'success'
      ? ''
      : submitting
        ? 'Processando...'
        : !canCreateCredit || paidCents === totalCents
          ? `Confirmar e fechar ${entityLabel}`
          : paidCents === 0
            ? 'Fechar como fiado'
            : 'Confirmar e deixar saldo em fiado';

  const handlePrimaryAction = () => {
    if (state.kind !== 'success' || readOnly || submitting || conflict || !state.quote.canClose || invalidPayment) return;
    if (paidCents < totalCents) {
      if (!canCreateCredit) return;
      setSubmitError(false);
      setCustomerSearchQuery('');
      setCustomerSearchVisible(false);
      setCreditModalVisible(true);
    } else {
      void submit();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description={
          state.kind === 'success'
            ? `${
                state.comanda.table
                  ? `Mesa ${state.comanda.table.number}`
                  : state.comanda.tableName ?? 'Comanda'
              } · Comanda #${state.comanda.number}`
            : undefined
        }
        onBack={onBack}
        title={headingTitle}
      />
      <ScrollView contentContainerStyle={checkoutStyles.content} keyboardShouldPersistTaps="handled" style={styles.scroll}>
        {state.kind === 'loading' && <ActivityIndicator color={themeColors.primaryActivity} />}
        {state.kind === 'error' && <>
          <Text accessibilityRole="alert" style={styles.error}>Não foi possível carregar o fechamento. Verifique a conexão e tente novamente.</Text>
          <CreditButton label="Tentar novamente" onPress={refresh} tone="secondary" />
        </>}

        {state.kind === 'success' && (
          <>
            <CheckoutTotal comanda={displayComanda!} />
            {state.quote.eligible && <>
              <ServiceFeeChoice included={includeServiceFee} disabled={submitting || readOnly || conflict} onChange={setIncludeServiceFee} />
              <ServiceFeeBreakdown fee={{ included: includeServiceFee, percent: includeServiceFee ? 10 : 0,
                subtotalCents: state.quote.subtotalCents, amountCents: includeServiceFee ? state.quote.serviceFee.amountCents : 0 }} />
            </>}
            {!state.quote.eligible && state.comanda.serviceFee && <ServiceFeeBreakdown fee={state.comanda.serviceFee} />}
            {printedChoice !== null && printedChoice !== includeServiceFee && <Text accessibilityLiveRegion="polite" style={checkoutStyles.creditWarning}>A conta impressa está desatualizada. Imprima novamente com o total atual.</Text>}
              <PaymentForm
                allowZero
                disabled={submitting || readOnly || conflict}
                maxCents={totalCents}
                variant="checkout"
                onPaymentChange={handlePaymentChange}
              />
            <CheckoutSummary comanda={displayComanda!} paidCents={paidCents} payments={payments} valid={!invalidPayment} />
            {paidCents > totalCents && <Text accessibilityRole="alert" style={styles.error}>Os pagamentos ultrapassam o novo total. Ajuste os valores para continuar.</Text>}
            {state.quote.eligible && !readOnly && normalizedApiBaseUrl && <ThermalPrintSection key={`${includeServiceFee}:${state.quote.expectedSnapshot}`} apiBaseUrl={normalizedApiBaseUrl}
              canPrint={canPrint} comandaId={comandaId} disabled={submitting || conflict || !state.quote.canClose}
              checkoutPreview={{ includeServiceFee, expectedSnapshot: state.quote.expectedSnapshot }}
              onPrinted={() => setPrintedChoice(includeServiceFee)} onConflict={() => setConflict(true)} />}
            {!readOnly && !state.quote.canClose && <Text style={checkoutStyles.creditWarning}>Confirme ou descarte os itens temporários antes de fechar ou imprimir a conta.</Text>}
            {readOnly && <Text style={checkoutStyles.creditWarning}>Esta comanda já foi encerrada. Volte para consultar os detalhes.</Text>}

            {!readOnly && remainingCents > 0 && !canCreateCredit && (
              <Text style={checkoutStyles.creditWarning}>
                Informe o pagamento integral para fechar a comanda.
              </Text>
            )}

            {!readOnly && remainingCents > 0 && canCreateCredit && (
              <Text style={checkoutStyles.creditWarning}>
                O saldo restante será registrado no fiado e exige uma pessoa
                responsável.
              </Text>
            )}

          </>
        )}

        {submitError && <Text accessibilityRole="alert" style={styles.error}>Não foi possível fechar a comanda. Verifique a conexão, os valores e a pessoa responsável antes de tentar novamente.</Text>}
        {conflict && <><Text accessibilityRole="alert" style={styles.error}>A conta mudou. Recarregue para conferir os valores; os pagamentos digitados serão limpos.</Text>
          <CreditButton label="Recarregar conta" onPress={refresh} /></>}
      </ScrollView>

      {state.kind === 'success' && (
        <View style={checkoutStyles.footer} testID="checkout-footer">
          <CreditButton
            disabled={submitting || readOnly || conflict || !state.quote.canClose || invalidPayment || remainingCents > 0}
            label={submitting ? 'Processando...' : `Confirmar e fechar ${entityLabel}`}
            onPress={handlePrimaryAction}
          />
          {!readOnly && canCreateCredit && remainingCents > 0 && <CreditButton
            disabled={submitting || conflict || !state.quote.canClose || invalidPayment}
            label={primaryActionLabel} onPress={handlePrimaryAction} tone="secondary"
          />}
        </View>
      )}

      {state.kind === 'success' && canCreateCredit && !readOnly && (
        <Modal
          animationType="fade"
          onRequestClose={modalBack}
          transparent
          visible={creditModalVisible}
        >
          <View style={modalStyles.backdrop}>
            <View style={modalStyles.sheet}>
              <View style={modalStyles.handle} />
              <Text style={styles.sectionTitle}>Selecionar fiado</Text>
              <Text style={styles.description}>
                O saldo de{' '}
                {formatCentsAsBrl(totalCents - paidCents)} ficará em
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
                        <View style={modalStyles.customerHeading}>
                          <Text style={styles.cardTitle}>{customer.name}</Text>
                          <Text style={modalStyles.radio}>
                            {customerId === customer.id ? '●' : '○'}
                          </Text>
                        </View>
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

              {selectedCustomer && (
                <View style={modalStyles.selectionSummary}>
                  <Text style={modalStyles.selectionTitle}>
                    Responsável: {selectedCustomer.name}
                  </Text>
                  <Text style={modalStyles.selectionBalance}>
                    Novo saldo: {formatCentsAsBrl(remainingCents)}
                  </Text>
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
                    label="Confirmar fiado e fechar mesa"
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

const checkoutStyles = StyleSheet.create({
  content: { alignSelf: 'center', gap: 16, maxWidth: 640, padding: 16, paddingBottom: 24, width: '100%' },
  creditWarning: {
    backgroundColor: themeColors.statusAwaitingSurface,
    borderColor: themeColors.statusAwaitingBorder,
    borderRadius: 16,
    borderWidth: 1,
    color: themeColors.statusAwaitingText,
    fontSize: 13,
    lineHeight: 19,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  footer: {
    alignSelf: 'center',
    backgroundColor: themeColors.background,
    borderTopColor: themeColors.divider,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 640,
  },
});

const modalStyles = StyleSheet.create({
  action: { width: '100%' },
  actions: { flexDirection: 'column-reverse', gap: 10 },
  backdrop: {
    backgroundColor: 'rgba(30, 22, 16, 0.48)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  customerHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: themeColors.border,
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  list: { maxHeight: 230 },
  listContent: { gap: 10 },
  newCredit: { gap: 10 },
  radio: {
    color: themeColors.primary,
    fontSize: 20,
  },
  selectedCustomer: {
    borderColor: themeColors.primary,
    borderWidth: 2,
  },
  searchSection: { gap: 10 },
  selectionBalance: {
    color: themeColors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  selectionSummary: {
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.divider,
    borderRadius: 22,
    borderWidth: 1,
    gap: 5,
    padding: 16,
  },
  selectionTitle: {
    color: themeColors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  sheet: {
    backgroundColor: themeColors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 14,
    maxHeight: '92%',
    maxWidth: 560,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
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
