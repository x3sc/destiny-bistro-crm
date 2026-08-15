import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  confirmComandaItem,
  loadComanda,
  type Comanda,
} from '../services/comandas-api';
import {
  advanceDeliveryOrder,
  loadDeliveryCouriers,
  loadDeliveryOrder,
  type DeliveryCourierSummary,
  type DeliveryOrder,
  type DeliveryOrderStatus,
} from '../services/deliveries-api';
import { formatCentsAsBrl } from '../services/money';
import { formatBrazilianMobile } from '../services/phone';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import { deliveryOrderStyles as styles } from './delivery-order-screens.styles';
import { DeliveryButton, formatDateTime, TotalRow } from './delivery-screen-parts';

const statusLabels: Record<DeliveryOrderStatus, string> = {
  DELIVERED: 'Entregue',
  NEW: 'Novo',
  OUT_FOR_DELIVERY: 'Em rota',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
};

export function DeliveryOrderDetailsScreen({
  advanceRequest = advanceDeliveryOrder,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  confirmRequest = confirmComandaItem,
  loadComandaRequest = loadComanda,
  loadCouriersRequest = loadDeliveryCouriers,
  loadOrderRequest = loadDeliveryOrder,
  onAddProducts,
  onBack,
  onCheckout,
  orderId,
  readOnly = false,
}: {
  advanceRequest?: typeof advanceDeliveryOrder;
  apiBaseUrl?: string;
  confirmRequest?: typeof confirmComandaItem;
  loadComandaRequest?: typeof loadComanda;
  loadCouriersRequest?: typeof loadDeliveryCouriers;
  loadOrderRequest?: typeof loadDeliveryOrder;
  onAddProducts: (comandaId: string) => void;
  onBack: () => void;
  onCheckout: (order: DeliveryOrder) => void;
  orderId: string;
  readOnly?: boolean;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error' }
    | {
        comand: Comanda;
        couriers: DeliveryCourierSummary[];
        kind: 'success';
        order: DeliveryOrder;
      }
  >({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [selectingCourier, setSelectingCourier] = useState(false);
  const [actionError, setActionError] = useState(false);

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !orderId) {
      setState({ kind: 'error' });
      return;
    }
    setState({ kind: 'loading' });
    void loadOrderRequest(normalizedApiBaseUrl, orderId)
      .then((order) =>
        Promise.all([
          loadComandaRequest(normalizedApiBaseUrl, order.comandaId),
          loadCouriersRequest(normalizedApiBaseUrl),
        ]).then(([comand, couriers]) => ({ comand, couriers, order })),
      )
      .then(
        ({ comand, couriers, order }) =>
          setState({ comand, couriers, kind: 'success', order }),
        () => setState({ kind: 'error' }),
      );
  }, [
    loadComandaRequest,
    loadCouriersRequest,
    loadOrderRequest,
    normalizedApiBaseUrl,
    orderId,
  ]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const advance = async (
    status: Exclude<DeliveryOrderStatus, 'NEW'>,
    dayId?: string,
  ) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success' || saving) return;
    setSaving(true);
    setActionError(false);
    try {
      const order = await advanceRequest(
        normalizedApiBaseUrl,
        state.order.id,
        status,
        dayId,
      );
      setState({ ...state, order });
      setSelectingCourier(false);
    } catch {
      setActionError(true);
    } finally {
      setSaving(false);
    }
  };

  const confirmItem = async (itemId: string) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success' || saving) return;
    setSaving(true);
    setActionError(false);
    try {
      const comand = await confirmRequest(
        normalizedApiBaseUrl,
        state.comand.id,
        itemId,
      );
      const order = await loadOrderRequest(normalizedApiBaseUrl, state.order.id);
      setState({ ...state, comand, order });
    } catch {
      setActionError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader onBack={onBack} title="Pedido Delivery" />
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        {state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.meta}>Carregando pedido...</Text>
          </View>
        )}
        {state.kind === 'error' && (
          <>
            <Text style={styles.error}>Não foi possível carregar o pedido.</Text>
            <DeliveryButton label="Tentar novamente" onPress={refresh} tone="secondary" />
          </>
        )}
        {state.kind === 'success' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>
                  Pedido #{state.order.comandaNumber}
                </Text>
                <Text style={styles.badge}>{statusLabels[state.order.status]}</Text>
              </View>
              <Text style={styles.itemName}>{state.order.customerName}</Text>
              <Text style={styles.meta}>
                {formatBrazilianMobile(state.order.phone)}
              </Text>
              <Text style={styles.meta}>{state.order.address}</Text>
              <Text style={styles.itemMeta}>
                Criado em {formatDateTime(state.order.createdAt)}
              </Text>
              {state.order.courierName ? (
                <Text style={styles.itemMeta}>
                  Entregador: {state.order.courierName}
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Itens do pedido</Text>
              {state.comand.items.length === 0 ? (
                <Text style={styles.empty}>Nenhum produto adicionado.</Text>
              ) : (
                state.comand.items.map((item) => {
                  const pending = item.quantity > item.confirmedQuantity;
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemName}>
                        {item.quantity}× {item.productName}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {formatCentsAsBrl(item.subtotalCents)}
                        {pending ? ' · aguardando confirmação' : ' · confirmado'}
                      </Text>
                      {pending && !readOnly ? (
                        <DeliveryButton
                          disabled={saving}
                          label={`Confirmar ${item.productName}`}
                          onPress={() => void confirmItem(item.id)}
                          tone="secondary"
                        />
                      ) : null}
                    </View>
                  );
                })
              )}
              {state.order.status === 'NEW' && state.comand.status === 'OPEN' && !readOnly ? (
                <DeliveryButton
                  label="Adicionar produtos"
                  onPress={() => onAddProducts(state.order.comandaId)}
                  tone="secondary"
                />
              ) : null}
            </View>

            <View style={styles.totals}>
              <TotalRow
                label="Produtos"
                valueCents={state.order.totalCents - state.order.feeCents}
              />
              <TotalRow label="Taxa de entrega" valueCents={state.order.feeCents} />
              <TotalRow emphasis label="Total" valueCents={state.order.totalCents} />
              <Text style={styles.itemMeta}>
                {paymentLabel(state.order)}
              </Text>
            </View>

            {state.order.hasPendingItems ? (
              <Text style={styles.error}>
                Confirme todos os itens antes de iniciar o preparo ou receber o pagamento.
              </Text>
            ) : null}
            {state.order.status === 'OUT_FOR_DELIVERY' &&
            state.order.paymentStatus === 'OPEN' ? (
              <Text style={styles.error}>
                Registre o pagamento ou o fiado antes de confirmar a entrega.
              </Text>
            ) : null}
            {actionError ? (
              <Text style={styles.error}>Não foi possível concluir esta ação.</Text>
            ) : null}

            {!readOnly && state.order.status !== 'DELIVERED' ? (
              <View style={styles.actionRow}>
                {state.comand.status === 'OPEN' &&
                state.comand.items.length > 0 &&
                !state.order.hasPendingItems ? (
                  <DeliveryButton
                    disabled={saving}
                    label="Registrar pagamento"
                    onPress={() => onCheckout(state.order)}
                    tone="secondary"
                  />
                ) : null}
                <StatusAction
                  disabled={saving}
                  onAdvance={(status) => void advance(status)}
                  onSelectCourier={() => setSelectingCourier(true)}
                  order={state.order}
                />
              </View>
            ) : null}

            {selectingCourier ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Escolher entregador</Text>
                {state.couriers.filter((courier) => courier.activeDayId).length === 0 ? (
                  <Text style={styles.error}>
                    Nenhum entregador possui um dia aberto.
                  </Text>
                ) : (
                  state.couriers
                    .filter(
                      (courier): courier is DeliveryCourierSummary & { activeDayId: string } =>
                        Boolean(courier.activeDayId),
                    )
                    .map((courier) => (
                      <Pressable
                        accessibilityRole="button"
                        key={courier.id}
                        onPress={() => void advance('OUT_FOR_DELIVERY', courier.activeDayId)}
                        style={({ pressed }) => [
                          styles.card,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <Text style={styles.itemName}>{courier.name}</Text>
                        <Text style={styles.itemMeta}>Dia em andamento</Text>
                      </Pressable>
                    ))
                )}
                <DeliveryButton
                  label="Voltar"
                  onPress={() => setSelectingCourier(false)}
                  tone="secondary"
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusAction({
  disabled,
  onAdvance,
  onSelectCourier,
  order,
}: {
  disabled: boolean;
  onAdvance: (status: 'DELIVERED' | 'PREPARING' | 'READY') => void;
  onSelectCourier: () => void;
  order: DeliveryOrder;
}) {
  if (order.status === 'NEW') {
    return (
      <DeliveryButton
        disabled={disabled || order.itemCount === 0 || order.hasPendingItems}
        label="Iniciar preparo"
        onPress={() => onAdvance('PREPARING')}
      />
    );
  }
  if (order.status === 'PREPARING') {
    return (
      <DeliveryButton
        disabled={disabled}
        label="Marcar como pronto"
        onPress={() => onAdvance('READY')}
      />
    );
  }
  if (order.status === 'READY') {
    return (
      <DeliveryButton
        disabled={disabled}
        label="Escolher entregador e sair"
        onPress={onSelectCourier}
      />
    );
  }
  return (
    <DeliveryButton
      disabled={disabled || order.paymentStatus === 'OPEN'}
      label="Marcar como entregue"
      onPress={() => onAdvance('DELIVERED')}
    />
  );
}

function paymentLabel(order: DeliveryOrder) {
  if (order.paymentStatus === 'PAID') {
    return `Pago: ${formatCentsAsBrl(order.paidCents)}`;
  }
  if (order.paymentStatus === 'CREDIT') {
    return `Saldo registrado em fiado · recebido ${formatCentsAsBrl(order.paidCents)}`;
  }
  return 'Pagamento pendente';
}
