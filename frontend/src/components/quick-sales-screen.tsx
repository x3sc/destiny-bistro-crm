import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { loadQuickSales, openQuickSale, type Comanda } from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import { BrandedScreenHeader } from './branded-screen-header';
import { CreditButton } from './credit-screen-parts';
import { creditStyles as styles } from './credit-screens.styles';

export function QuickSalesScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, canWrite = true,
  loadRequest = loadQuickSales, openRequest = openQuickSale, onBack, onSelect,
}: {
  apiBaseUrl?: string; canWrite?: boolean;
  loadRequest?: typeof loadQuickSales; openRequest?: typeof openQuickSale;
  onBack: () => void; onSelect: (comanda: Comanda) => void;
}) {
  const url = normalizeApiBaseUrl(apiBaseUrl);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string>();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'error' } | { kind: 'success'; sales: Comanda[] }
  >({ kind: 'loading' });
  const loadVersion = useRef(0);
  const refresh = useCallback(() => {
    const version = ++loadVersion.current;
    setState({ kind: 'loading' });
    if (!url) { setState({ kind: 'error' }); return; }
    void loadRequest(url).then(
      (sales) => { if (version === loadVersion.current) setState({ kind: 'success', sales }); },
      () => { if (version === loadVersion.current) setState({ kind: 'error' }); },
    );
  }, [url, loadRequest]);
  useFocusEffect(useCallback(() => {
    refresh();
    return () => { loadVersion.current += 1; };
  }, [refresh]));
  const submit = async () => {
    if (!url || !canWrite || !name.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const sale = await openRequest(url, name.trim());
      setName('');
      refresh();
      onSelect(sale);
    } catch {
      setError('Não foi possível abrir a venda rápida.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const sales = state.kind === 'success' ? state.sales.filter((sale) =>
    `${sale.number} ${sale.name ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
  ) : [];
  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader title="Venda rápida" description="Atenda seu cliente sem vincular uma mesa" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!url && <Text style={styles.error}>Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo.</Text>}
        {canWrite && <View style={styles.card}>
          <Text style={styles.cardTitle}>Nova venda</Text>
          <Text style={styles.description}>Informe o cliente para abrir a comanda e adicionar os produtos.</Text>
          <Text style={styles.summaryLabel}>Nome do cliente</Text>
          <TextInput accessibilityLabel="Nome do cliente" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" editable={!submitting} style={styles.field} placeholder="Ex.: Maria" />
          {error && <Text style={styles.error}>{error}</Text>}
          <CreditButton label={submitting ? 'Abrindo...' : 'Abrir venda rápida'} disabled={!url || !name.trim() || submitting} onPress={() => { void submit(); }} />
        </View>}
        <Text style={styles.cardTitle}>Vendas em aberto</Text>
        <TextInput accessibilityLabel="Buscar venda rápida" placeholder="Nome do cliente ou número da comanda" value={query} onChangeText={setQuery} style={styles.field} />
        {state.kind === 'loading' && <ActivityIndicator accessibilityLabel="Carregando vendas rápidas" />}
        {state.kind === 'error' && <Text style={styles.error}>Não foi possível carregar as vendas rápidas.</Text>}
        <CreditButton label="Atualizar vendas" tone="secondary" onPress={refresh} />
        {state.kind === 'success' && sales.length === 0 && <Text style={styles.empty}>{query.trim() ? 'Nenhuma venda encontrada.' : 'Nenhuma venda rápida em aberto.'}</Text>}
        {sales.map((sale) => <Pressable key={sale.id} accessibilityRole="button" accessibilityLabel={`Comanda ${sale.number}, ${sale.name}`} onPress={() => onSelect(sale)} style={styles.card}>
          <Text style={styles.cardTitle}>{sale.name}</Text>
          <Text style={styles.description}>Comanda #{sale.number} · Venda rápida</Text>
          <Text style={styles.balance}>{formatCentsAsBrl(sale.totalCents)}</Text>
        </Pressable>)}
      </ScrollView>
    </SafeAreaView>
  );
}
