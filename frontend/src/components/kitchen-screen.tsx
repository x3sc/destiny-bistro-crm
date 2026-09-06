import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  loadKitchenTickets,
  type KitchenTicket,
  type KitchenTicketStatus,
  updateKitchenTicketStatus,
} from '../services/kitchen-api';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';

const statusLabels: Record<KitchenTicketStatus, string> = {
  CANCELLED: 'Cancelado',
  DELIVERED: 'Entregue',
  PENDING: 'Pendente',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
};

const nextStatus: Partial<Record<KitchenTicketStatus, KitchenTicketStatus>> = {
  PENDING: 'PREPARING',
  PREPARING: 'READY',
  READY: 'DELIVERED',
};

const nextAction: Partial<Record<KitchenTicketStatus, string>> = {
  PENDING: 'Iniciar preparo',
  PREPARING: 'Marcar como pronto',
  READY: 'Entregue',
};

export function KitchenScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  canWrite = true,
  loadRequest = loadKitchenTickets,
  onBack,
  updateRequest = updateKitchenTicketStatus,
}: {
  apiBaseUrl?: string;
  canWrite?: boolean;
  loadRequest?: typeof loadKitchenTickets;
  onBack: () => void;
  updateRequest?: typeof updateKitchenTicketStatus;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'success'; tickets: KitchenTicket[] }
  >({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [mutatingId, setMutatingId] = useState<string>();

  const refresh = useCallback(
    async (showLoading = false) => {
      if (!normalizedApiBaseUrl) {
        setState({ kind: 'error' });
        return;
      }
      if (showLoading) setState({ kind: 'loading' });
      try {
        const tickets = await loadRequest(normalizedApiBaseUrl);
        setState({ kind: 'success', tickets });
      } catch {
        setState((current) =>
          current.kind === 'success' ? current : { kind: 'error' },
        );
      } finally {
        setRefreshing(false);
      }
    },
    [loadRequest, normalizedApiBaseUrl],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh(true);
      const interval = setInterval(() => void refresh(), 30_000);
      return () => clearInterval(interval);
    }, [refresh]),
  );

  const changeStatus = useCallback(
    async (ticket: KitchenTicket, status: KitchenTicketStatus) => {
      if (!normalizedApiBaseUrl || mutatingId) return;
      setMutatingId(ticket.id);
      try {
        const updated = await updateRequest(
          normalizedApiBaseUrl,
          ticket.id,
          status,
        );
        setState((current) =>
          current.kind === 'success'
            ? {
                kind: 'success',
                tickets:
                  updated.status === 'DELIVERED' ||
                  updated.status === 'CANCELLED'
                    ? current.tickets.filter(({ id }) => id !== updated.id)
                    : current.tickets.map((entry) =>
                        entry.id === updated.id ? updated : entry,
                      ),
              }
            : current,
        );
      } catch {
        setState({ kind: 'error' });
      } finally {
        setMutatingId(undefined);
      }
    },
    [mutatingId, normalizedApiBaseUrl, updateRequest],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Pedidos confirmados aguardando preparo"
        onBack={onBack}
        title="Cozinha"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              void refresh();
            }}
            refreshing={refreshing}
            tintColor={themeColors.primary}
          />
        }
      >
        {state.kind === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={themeColors.primary} size="large" />
            <Text style={styles.meta}>Carregando fila da cozinha...</Text>
          </View>
        ) : null}
        {state.kind === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.error}>
              Não foi possível carregar a fila da cozinha.
            </Text>
            <ActionButton label="Tentar novamente" onPress={() => void refresh(true)} />
          </View>
        ) : null}
        {state.kind === 'success' && state.tickets.length === 0 ? (
          <Text style={styles.empty}>Nenhum item aguardando preparo.</Text>
        ) : null}
        {state.kind === 'success'
          ? state.tickets.map((ticket) => {
              const target = nextStatus[ticket.status];
              return (
                <View key={ticket.id} style={styles.card}>
                  <View style={styles.cardHeading}>
                    <View>
                      <Text style={styles.ticketTitle}>
                        COMANDA #{ticket.comandaNumber}
                      </Text>
                      <Text style={styles.meta}>
                        {ticket.table ? `Mesa ${ticket.table.number}` : 'Delivery'}
                        {' · '}
                        {relativeAge(ticket.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.badge}>{statusLabels[ticket.status]}</Text>
                  </View>
                  {ticket.items.map((item) => (
                    <View key={item.id} style={styles.item}>
                      <Text style={styles.itemTitle}>
                        {item.quantity}x {item.productName}
                      </Text>
                      {item.configurations.map((configuration) => (
                        <View key={configuration.id} style={styles.configuration}>
                          {item.configurations.length > 1 ? (
                            <Text style={styles.configurationTitle}>
                              {configuration.quantity}x configuração
                            </Text>
                          ) : null}
                          {configuration.additionals.map((additional) => (
                            <Text key={additional.id} style={styles.additional}>
                              + {additional.quantityPerUnit}x {additional.additionalName}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  ))}
                  {canWrite && target ? (
                    <View style={styles.actions}>
                      <ActionButton
                        disabled={mutatingId === ticket.id}
                        label={nextAction[ticket.status] ?? 'Avançar'}
                        onPress={() => void changeStatus(ticket, target)}
                      />
                      <ActionButton
                        disabled={mutatingId === ticket.id}
                        label="Cancelar ticket"
                        onPress={() =>
                          Alert.alert(
                            'Cancelar ticket',
                            'Deseja cancelar este envio para a cozinha?',
                            [
                              { style: 'cancel', text: 'Voltar' },
                              {
                                onPress: () =>
                                  void changeStatus(ticket, 'CANCELLED'),
                                style: 'destructive',
                                text: 'Cancelar ticket',
                              },
                            ],
                          )
                        }
                        tone="danger"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' && styles.dangerButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function relativeAge(value: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return 'agora';
  if (elapsedMinutes === 1) return 'há 1 min';
  return `há ${elapsedMinutes} min`;
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  additional: { color: themeColors.foregroundBody, fontSize: 14 },
  badge: { backgroundColor: themeColors.surfaceAccent, borderRadius: 999, color: themeColors.primary, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  button: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: themeColors.foregroundOnPrimary, fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 18, borderWidth: 1, gap: 14, padding: 18 },
  cardHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  configuration: { borderLeftColor: themeColors.accent, borderLeftWidth: 3, gap: 3, paddingLeft: 10 },
  configurationTitle: { color: themeColors.foregroundMuted, fontSize: 13, fontWeight: '700' },
  content: { alignSelf: 'center', gap: 14, maxWidth: 760, padding: 20, width: '100%' },
  dangerButton: { backgroundColor: themeColors.dangerSolid },
  disabled: { opacity: 0.55 },
  empty: { color: themeColors.foregroundMuted, fontSize: 16, paddingVertical: 40, textAlign: 'center' },
  error: { color: themeColors.dangerText, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  item: { borderTopColor: themeColors.divider, borderTopWidth: 1, gap: 8, paddingTop: 12 },
  itemTitle: { color: themeColors.foreground, fontSize: 18, fontWeight: '800' },
  meta: { color: themeColors.foregroundMuted, fontSize: 14 },
  pressed: { opacity: 0.78 },
  safeArea: { backgroundColor: themeColors.background, flex: 1 },
  ticketTitle: { color: themeColors.primary, fontSize: 20, fontWeight: '900' },
});
