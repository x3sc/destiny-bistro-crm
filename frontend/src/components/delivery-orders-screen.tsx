import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  loadDeliveryOrders,
  type DeliveryOrder,
  type DeliveryOrderStatus,
} from '../services/deliveries-api';
import { formatCentsAsBrl } from '../services/money';
import { formatBrazilianMobile } from '../services/phone';
import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';
import { BrandedScreenHeader } from './branded-screen-header';
import { deliveryOrderStyles as styles } from './delivery-order-screens.styles';
import { DeliverySectionTabs } from './delivery-section-tabs';
import { DeliveryButton, formatDateTime } from './delivery-screen-parts';

type Filter = 'ALL' | DeliveryOrderStatus;

const statusLabels: Record<DeliveryOrderStatus, string> = {
  DELIVERED: 'Entregue',
  NEW: 'Novo',
  OUT_FOR_DELIVERY: 'Em rota',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
};

const filters: { label: string; value: Filter }[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Novos', value: 'NEW' },
  { label: 'Em preparo', value: 'PREPARING' },
  { label: 'Prontos', value: 'READY' },
  { label: 'Em rota', value: 'OUT_FOR_DELIVERY' },
  { label: 'Histórico', value: 'DELIVERED' },
];

export function DeliveryOrdersScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  canWrite = true,
  loadRequest = loadDeliveryOrders,
  onBack,
  onCouriers,
  onNewOrder,
  onSelectOrder,
}: {
  apiBaseUrl?: string;
  canWrite?: boolean;
  loadRequest?: typeof loadDeliveryOrders;
  onBack: () => void;
  onCouriers: () => void;
  onNewOrder: () => void;
  onSelectOrder: (order: DeliveryOrder) => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'success'; orders: DeliveryOrder[] }
  >({ kind: 'loading' });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setState({ kind: 'error' });
      return;
    }
    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, true).then(
      (orders) => setState({ kind: 'success', orders }),
      () => setState({ kind: 'error' }),
    );
  }, [loadRequest, normalizedApiBaseUrl]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const orders = useMemo(
    () => (state.kind === 'success' ? state.orders : []),
    [state],
  );
  const normalizedQuery = normalize(query);
  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (filter === 'ALL'
            ? order.status !== 'DELIVERED'
            : order.status === filter) &&
          (!normalizedQuery ||
            normalize(
              `${order.comandaNumber} ${order.customerName} ${order.phone} ${formatBrazilianMobile(order.phone)} ${order.address}`,
            ).includes(normalizedQuery)),
      ),
    [filter, normalizedQuery, orders],
  );
  const columns = width >= 1100 ? 4 : width >= 760 ? 2 : 1;
  const availableWidth = Math.max(Math.min(width, 1180) - 36, 0);
  const cardWidth = (availableWidth - 12 * (columns - 1)) / columns;

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Organize pedidos do cardápio até a entrega ao cliente"
        onBack={onBack}
        title="Delivery"
      />
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <DeliverySectionTabs
          active="orders"
          onCouriers={onCouriers}
          onOrders={() => undefined}
        />
        {canWrite ? (
          <DeliveryButton label="Novo pedido" onPress={onNewOrder} />
        ) : null}

        <View style={styles.summaryRow}>
          {(['NEW', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as const).map(
            (status) => (
              <View key={status} style={styles.summaryCard}>
                <Text style={styles.summaryCount}>
                  {orders.filter((order) => order.status === status).length}
                </Text>
                <Text style={styles.summaryLabel}>{statusLabels[status]}</Text>
              </View>
            ),
          )}
        </View>

        <View style={styles.searchField}>
          <AppIcon color={themeColors.icon} name="search" size={22} />
          <TextInput
            accessibilityLabel="Buscar pedido, cliente, telefone ou endereço"
            accessibilityRole="search"
            onChangeText={setQuery}
            placeholder="Buscar pedido, cliente, telefone ou endereço..."
            placeholderTextColor={themeColors.placeholder}
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {filters.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option.value }}
                key={option.value}
                onPress={() => setFilter(option.value)}
                style={[styles.tab, filter === option.value && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    filter === option.value && styles.tabTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.meta}>Carregando pedidos...</Text>
          </View>
        )}
        {state.kind === 'error' && (
          <>
            <Text style={styles.error}>Não foi possível carregar os pedidos.</Text>
            <DeliveryButton label="Tentar novamente" onPress={refresh} tone="secondary" />
          </>
        )}
        {state.kind === 'success' && visibleOrders.length === 0 && (
          <Text style={styles.empty}>
            {filter === 'DELIVERED'
              ? 'Nenhum pedido entregue no histórico.'
              : 'Nenhum pedido encontrado para este filtro.'}
          </Text>
        )}
        {state.kind === 'success' && visibleOrders.length > 0 && (
          <View style={styles.grid}>
            {visibleOrders.map((order) => (
              <Pressable
                accessibilityLabel={`Abrir pedido ${order.comandaNumber}`}
                accessibilityRole="button"
                key={order.id}
                onPress={() => onSelectOrder(order)}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardHeading}>
                  <Text style={styles.cardTitle}>Pedido #{order.comandaNumber}</Text>
                  <Text style={styles.badge}>{statusLabels[order.status]}</Text>
                </View>
                <Text style={styles.itemName}>{order.customerName}</Text>
                <Text style={styles.meta}>{order.address}</Text>
                <Text style={styles.meta}>
                  {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'} ·{' '}
                  {formatCentsAsBrl(order.totalCents)}
                </Text>
                <Text style={styles.itemMeta}>
                  {paymentLabel(order)} · {formatDateTime(order.createdAt)}
                </Text>
                {order.courierName ? (
                  <Text style={styles.itemMeta}>Entregador: {order.courierName}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function paymentLabel(order: DeliveryOrder) {
  if (order.paymentStatus === 'PAID') return 'Pago';
  if (order.paymentStatus === 'CREDIT') return 'Em fiado';
  return 'Pagamento pendente';
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR');
}
