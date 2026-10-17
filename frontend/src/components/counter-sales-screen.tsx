import type { Comanda } from '../services/comandas-api';
import { counterRequestId, counterToday, loadCounterSales, openCounterSale } from '../services/counter-sales-api';
import { useCallback, useRef, useState } from 'react';
import { useNavigationGuard, useSafeNavigationCompletion } from '../navigation/safe-navigation';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors } from '../theme/tokens';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { formatCentsAsBrl } from '../services/money';
import { BrandedScreenHeader } from './branded-screen-header';
import { CreditButton } from './credit-screen-parts';
import { AppIcon } from './app-icon';

export interface CounterSalesScreenProps {
  apiBaseUrl?: string;
  canWrite: boolean;
  loadRequest?: typeof loadCounterSales;
  openRequest?: typeof openCounterSale;
  onBack: () => void;
  onOpened: (sale: Comanda) => void;
  onSelect: (sale: Comanda) => void;
}
export function CounterSalesScreen({ apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, canWrite,
  loadRequest = loadCounterSales, openRequest = openCounterSale, onBack, onOpened, onSelect }: CounterSalesScreenProps) {
  const url = normalizeApiBaseUrl(apiBaseUrl);
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [date, setDate] = useState(counterToday);
  const [dateInput, setDateInput] = useState(date);
  const [query, setQuery] = useState('');
  const [sales, setSales] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [busy, setBusy] = useState(false);
  const completeNavigation = useSafeNavigationCompletion();
  useNavigationGuard({ busy });
  const opening = useRef(false);
  const key = useRef<string | null>(null);
  const refresh = useCallback(() => {
    let current = true;
    setLoading(true); setLoadError(false);
    if (!url) { setLoadError(true); setLoading(false); return; }
    void loadRequest(url, status, date).then((items) => { if (current) setSales(items); }, () => {
      if (current) setLoadError(true);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [date, loadRequest, status, url]);
  useFocusEffect(refresh);
  const open = async () => {
    if (!url || !canWrite || opening.current) return;
    opening.current = true; setBusy(true); setOpenError(false);
    key.current ??= counterRequestId();
    try { const sale = await openRequest(url, key.current); key.current = null; completeNavigation(() => onOpened(sale)); }
    catch { setOpenError(true); }
    finally { opening.current = false; setBusy(false); }
  };
  return <SafeAreaView style={styles.safeArea}>
    <BrandedScreenHeader title="Balcão" description="Vendas registradas com pagamento no caixa externo" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text fontRole="heading" style={styles.title}>Comandas de Balcão</Text>
      <View style={styles.search}><AppIcon name="search" size={18} color={themeColors.foregroundMuted} />
        <TextInput accessibilityLabel="Buscar comanda ou cliente" placeholder="Buscar comanda ou cliente…" value={query} onChangeText={setQuery} style={styles.searchInput} />
      </View>
      {canWrite && <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Abrindo...' : 'Nova comanda'}
        disabled={busy || !url || loadError} onPress={() => { void open(); }}
        style={({ pressed }) => [styles.newButton, (busy || !url || loadError) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}>
        <AppIcon name="add" size={18} color={themeColors.primary} /><Text style={styles.newButtonText}>{busy ? 'Abrindo...' : 'Nova comanda'}</Text>
      </Pressable>}
      {openError && <Text accessibilityRole="alert" style={styles.error}>Não foi possível abrir a comanda. Tente novamente.</Text>}
      <View accessibilityRole="tablist" style={styles.tabs}>
        {(['OPEN', 'CLOSED'] as const).map((value) => <Pressable key={value} accessibilityRole="tab"
          accessibilityLabel={value === 'OPEN' ? 'Em atendimento' : 'Concluídas'} accessibilityState={{ selected: status === value }}
          onPress={() => setStatus(value)} style={[styles.tab, status === value && styles.activeTab]}>
          <Text style={[styles.tabText, status === value && styles.activeTabText]}>{value === 'OPEN' ? 'Em atendimento' : 'Concluídas'}</Text>
        </Pressable>)}
      </View>
      {status === 'CLOSED' && <View style={styles.day}>
        <Text style={styles.meta}>Dia da conclusão · horário de São Paulo</Text>
        <TextInput accessibilityLabel="Dia das vendas concluídas" placeholder="AAAA-MM-DD" value={dateInput} onChangeText={setDateInput} style={styles.field} />
        <CreditButton label="Consultar dia" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)} onPress={() => setDate(dateInput)} tone="secondary" />
      </View>}
      {loading ? <ActivityIndicator accessibilityLabel="Carregando Balcão" color={themeColors.primary} /> : loadError ? <>
        <Text accessibilityRole="alert" style={styles.error}>Não foi possível carregar o Balcão. Verifique a conexão.</Text>
        <CreditButton label="Tentar novamente" onPress={refresh} tone="secondary" />
      </> : <>
        {sales.filter((sale) => `${sale.number} ${sale.name ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))).map((sale) =>
          <Pressable key={sale.id} accessibilityRole="button" accessibilityLabel={`Visualizar comanda ${sale.number}`}
            onPress={() => onSelect(sale)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
            <View style={styles.row}><Text fontRole="heading" style={styles.cardTitle}>Comanda #{sale.number}</Text>
              <Text style={styles.badge}>{sale.status === 'OPEN' ? 'Em aberto' : 'Concluída'}</Text></View>
            {sale.name && <Text style={styles.cardTitle}>{sale.name}</Text>}
            <Text style={styles.meta}>{sale.items.length ? sale.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ') : 'Nenhum item lançado'}</Text>
            <View style={styles.row}><Text style={styles.meta}>Total</Text><Text fontRole="heading" style={styles.amount}>{formatCentsAsBrl(sale.totalCents)}</Text></View>
            <Text style={styles.link}>Visualizar comanda</Text>
          </Pressable>)}
        {sales.length === 0 && <Text style={styles.meta}>{status === 'OPEN' ? 'Nenhuma comanda em atendimento.' : 'Nenhuma venda concluída neste dia.'}</Text>}
        {sales.length > 0 && !sales.some((sale) => `${sale.number} ${sale.name ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))) && <Text style={styles.meta}>Nenhuma comanda encontrada.</Text>}
      </>}
      <Text style={styles.meta}>Meio de pagamento: Balcão. O app não processa o recebimento do caixa externo.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  newButton: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, minHeight: 48, backgroundColor: themeColors.accent, borderRadius: 12, padding: 12 },
  newButtonText: { color: themeColors.primary, fontWeight: '700', fontSize: 15 },
  safeArea: { flex: 1, backgroundColor: themeColors.background },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, padding: 20, gap: 16, paddingBottom: 32 },
  title: { color: themeColors.foreground, fontSize: 22, fontWeight: '800' },
  search: { alignItems: 'center', flexDirection: 'row', gap: 10, backgroundColor: themeColors.surfaceMuted, borderRadius: 12, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 48, color: themeColors.foreground, fontSize: 15 },
  tabs: { flexDirection: 'row', gap: 8 }, tab: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: themeColors.surfaceAccent },
  activeTab: { backgroundColor: themeColors.primary }, tabText: { color: themeColors.foregroundMuted, fontWeight: '700', fontSize: 13 }, activeTabText: { color: themeColors.foregroundOnPrimary },
  card: { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: themeColors.foreground, fontSize: 16, fontWeight: '700' },
  badge: { color: themeColors.statusOpenText, backgroundColor: themeColors.statusOpenSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11 },
  amount: { fontSize: 22, fontWeight: '800', color: themeColors.primary }, link: { color: themeColors.primary, fontWeight: '700', minHeight: 24 },
  meta: { color: themeColors.foregroundMuted, fontSize: 13, lineHeight: 19 }, error: { color: themeColors.dangerText, fontSize: 14, lineHeight: 20 },
  day: { gap: 10 }, field: { minHeight: 48, borderColor: themeColors.border, borderWidth: 1, borderRadius: 12, color: themeColors.foreground, paddingHorizontal: 12 },
});
