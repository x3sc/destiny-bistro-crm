import { useCallback, useRef, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { loadComanda, type Comanda } from '../services/comandas-api';
import { completeCounterSale, CounterSaleConflictError, counterRequestId, renameCounterSale } from '../services/counter-sales-api';
import { OperationalText as Text } from '../theme/operational-typography';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { ComandaDetailsScreen } from './comanda-details-screen';
import { CreditButton } from './credit-screen-parts';
import { useNavigationGuard, useSafeBack, useSafeNavigationCompletion } from '../navigation/safe-navigation';

export interface CounterSaleDetailsProps {
  apiBaseUrl?: string;
  comandaId: string;
  canWrite: boolean;
  canPrint?: boolean;
  canCancelConfirmed?: boolean;
  loadRequest?: typeof loadComanda;
  completeRequest?: typeof completeCounterSale;
  renameRequest?: typeof renameCounterSale;
  onAddProducts: (id: string) => void;
  onBack: () => void;
  onFinished: () => void;
}
export function CounterSaleDetailsScreen({ apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, comandaId, canWrite,
  canPrint = false, canCancelConfirmed = false, loadRequest = loadComanda,
  completeRequest = completeCounterSale, renameRequest = renameCounterSale,
  onAddProducts, onBack, onFinished }: CounterSaleDetailsProps) {
  const url = normalizeApiBaseUrl(apiBaseUrl);
  const [selected, setSelected] = useState<{ kind: 'complete' | 'name'; sale: Comanda } | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);
  const completeNavigation = useSafeNavigationCompletion();
  const modalBack = useSafeBack(() => { if (!lock.current) setSelected(null); });
  useNavigationGuard({ busy, closeModal: selected ? () => setSelected(null) : undefined });
  const loadCounter = useCallback(async (base: string, id: string) => {
    const sale = await loadRequest(base, id);
    if (sale.tableName !== 'Balcão' || sale.table !== null || sale.credit) throw new Error('Comanda não pertence ao Balcão');
    return sale;
  }, [loadRequest]);
  const select = (sale: Comanda, kind: 'complete' | 'name') => {
    if (!canWrite || sale.status !== 'OPEN' || lock.current || sale.tableName !== 'Balcão') return;
    if (kind === 'complete' && (!sale.items.length || sale.totalCents <= 0 || sale.items.some((item) => item.quantity !== item.confirmedQuantity))) return;
    setError(''); setConflict(false); setName(sale.name ?? ''); setSelected({ sale, kind });
    requestId.current ??= counterRequestId();
  };
  const submit = async () => {
    if (!selected || !url || !canWrite || lock.current || conflict) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (selected.kind === 'complete') {
        requestId.current ??= counterRequestId();
        if (!selected.sale.counterSnapshot) throw new CounterSaleConflictError();
        await completeRequest(url, comandaId, requestId.current, selected.sale.counterSnapshot);
        completeNavigation(onFinished);
      } else {
        await renameRequest(url, comandaId, name);
        setRevision((value) => value + 1);
      }
      setSelected(null); requestId.current = null;
    } catch (failure) {
      if (failure instanceof CounterSaleConflictError) {
        setConflict(true); setError('A comanda mudou. Recarregue antes de continuar.');
      } else setError(selected.kind === 'complete' ? 'Não foi possível concluir a venda. Verifique a conexão e tente novamente.' : 'Não foi possível salvar a identificação. Tente novamente.');
    } finally { lock.current = false; setBusy(false); }
  };
  const closeModal = () => { if (!lock.current) setSelected(null); };
  return <>
    <ComandaDetailsScreen key={revision} apiBaseUrl={apiBaseUrl} comandaId={comandaId} canPrint={canPrint}
      canCancelConfirmed={canCancelConfirmed} loadRequest={loadCounter} readOnly={!canWrite}
      onAddProducts={onAddProducts} onBack={onBack} onCancelled={onFinished}
      onEditCounterName={(sale) => select(sale, 'name')} onCheckout={(sale) => select(sale, 'complete')} />
    <Modal visible={selected !== null} transparent animationType="none" onRequestClose={modalBack}>
      <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
        <Text fontRole="heading" style={styles.title}>{selected?.kind === 'name' ? 'Identificação opcional' : 'Concluir venda de Balcão'}</Text>
        {selected?.kind === 'name' ? <TextInput accessibilityLabel="Nome do cliente (opcional)" maxLength={80}
          value={name} onChangeText={setName} editable={!busy} style={styles.field} placeholder="Nome do cliente, se desejar" /> : <>
          <Text style={styles.description}>O recebimento ocorre no caixa externo. Ao confirmar, o app registra esta venda como concluída e paga pelo meio Balcão. Não há integração ou confirmação automática pelo outro sistema.</Text>
          <Text fontRole="heading" style={styles.total}>{formatCentsAsBrl(selected?.sale.totalCents ?? 0)}</Text>
        </>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {conflict ? <CreditButton label="Recarregar comanda" onPress={() => { setSelected(null); requestId.current = null; setRevision((value) => value + 1); }} /> :
          <CreditButton disabled={busy || !url} label={busy ? 'Registrando...' : selected?.kind === 'name' ? 'Salvar identificação' : 'Confirmar venda paga no Balcão'} onPress={() => { void submit(); }} />}
        <CreditButton label="Voltar à comanda" disabled={busy} onPress={closeModal} tone="secondary" />
      </View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 520, backgroundColor: themeColors.background, borderRadius: 16, padding: 20, gap: 16 },
  title: { color: themeColors.primary, fontWeight: '800', fontSize: 21 },
  description: { color: themeColors.foregroundBody, fontSize: 15, lineHeight: 22 },
  total: { color: themeColors.primary, fontSize: 30, fontWeight: '800' }, error: { color: themeColors.dangerText, lineHeight: 20 },
  field: { borderColor: themeColors.border, borderWidth: 1, borderRadius: 12, minHeight: 48, padding: 12, color: themeColors.foreground },
});
