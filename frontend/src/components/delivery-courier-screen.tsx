import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  loadDeliveryCourier,
  openDeliveryDay,
  type DeliveryCourierDetails,
  type DeliveryDaySummary,
} from '../services/deliveries-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import {
  DeliveryButton,
  formatDate,
  MoneyField,
  TotalRow,
} from './delivery-screen-parts';
import { deliveryStyles } from './delivery-screens.styles';

export type DeliveryPeriodFilter = 'ALL' | 'LAST_7_DAYS' | 'THIS_MONTH';

type State =
  | { courier: DeliveryCourierDetails; kind: 'success' }
  | { kind: 'error' }
  | { kind: 'loading' };

const filterLabels: Record<DeliveryPeriodFilter, string> = {
  ALL: 'Tudo',
  LAST_7_DAYS: 'Últimos 7 dias',
  THIS_MONTH: 'Este mês',
};

const filterOrder: DeliveryPeriodFilter[] = ['ALL', 'LAST_7_DAYS', 'THIS_MONTH'];

export function resolvePeriod(
  filter: DeliveryPeriodFilter,
  today = new Date(),
): { from: string; to: string } | undefined {
  if (filter === 'ALL') {
    return undefined;
  }

  const to = dateKey(today);

  if (filter === 'LAST_7_DAYS') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: dateKey(from), to };
  }

  return { from: `${to.slice(0, 7)}-01`, to };
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DeliveryCourierScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  courierId,
  loadRequest = loadDeliveryCourier,
  onBack,
  onOpenDay,
  openDayRequest = openDeliveryDay,
}: {
  apiBaseUrl?: string;
  courierId: string;
  loadRequest?: typeof loadDeliveryCourier;
  onBack: () => void;
  onOpenDay: (dayId: string) => void;
  openDayRequest?: typeof openDeliveryDay;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [filter, setFilter] = useState<DeliveryPeriodFilter>('ALL');
  const [dailyRateCents, setDailyRateCents] = useState(0);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(
    (selectedFilter: DeliveryPeriodFilter) => {
      if (!normalizedApiBaseUrl) {
        setState({ kind: 'error' });
        return;
      }

      setState({ kind: 'loading' });
      void loadRequest(
        normalizedApiBaseUrl,
        courierId,
        resolvePeriod(selectedFilter),
      ).then(
        (courier) => {
          setState({ courier, kind: 'success' });
        },
        () => {
          setState({ kind: 'error' });
        },
      );
    },
    [courierId, loadRequest, normalizedApiBaseUrl],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [filter, load]),
  );

  const startDay = () => {
    if (!normalizedApiBaseUrl || starting) {
      return;
    }

    setStarting(true);
    setFormError(null);
    void openDayRequest(normalizedApiBaseUrl, courierId, dailyRateCents).then(
      (day) => {
        setStarting(false);
        setDailyRateCents(0);
        onOpenDay(day.id);
      },
      (error: unknown) => {
        setStarting(false);
        setFormError(
          error instanceof Error
            ? error.message
            : 'Não foi possível iniciar o dia.',
        );
      },
    );
  };

  const courier = state.kind === 'success' ? state.courier : null;

  return (
    <SafeAreaView style={deliveryStyles.safeArea}>
      <BrandedScreenHeader
        description="Dias trabalhados e valores pagos"
        onBack={onBack}
        title={courier?.name ?? 'Entregador'}
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
            <Text style={deliveryStyles.description}>Carregando...</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={deliveryStyles.actions}>
            <Text style={deliveryStyles.error}>
              Não foi possível carregar o entregador.
            </Text>
            <DeliveryButton
              label="Tentar novamente"
              onPress={() => {
                load(filter);
              }}
            />
          </View>
        )}

        {courier ? (
          <>
            <View style={deliveryStyles.summaryCard}>
              <Text style={deliveryStyles.summaryLabel}>
                Total já recebido pelo entregador
              </Text>
              <Text style={deliveryStyles.summaryValue}>
                {formatCentsAsBrl(courier.settledTotalCents)}
              </Text>
              <Text style={deliveryStyles.description}>
                Somando todos os dias já fechados.
              </Text>
            </View>

            {courier.activeDayId ? (
              <View style={deliveryStyles.actions}>
                <Text style={deliveryStyles.notice}>
                  Este entregador tem um dia em aberto.
                </Text>
                <DeliveryButton
                  label="Abrir o dia em andamento"
                  onPress={() => {
                    onOpenDay(courier.activeDayId as string);
                  }}
                />
              </View>
            ) : (
              <View style={deliveryStyles.formCard}>
                <Text style={deliveryStyles.sectionTitle}>Iniciar um dia</Text>
                <MoneyField
                  label="Valor da diária"
                  onChangeCents={setDailyRateCents}
                  valueCents={dailyRateCents}
                />
                {formError ? (
                  <Text style={deliveryStyles.error}>{formError}</Text>
                ) : null}
                <DeliveryButton
                  disabled={starting}
                  label={starting ? 'Iniciando...' : 'Iniciar dia'}
                  onPress={startDay}
                />
              </View>
            )}

            <View style={deliveryStyles.list}>
              <Text style={deliveryStyles.sectionTitle}>Histórico</Text>
              <View style={deliveryStyles.methodRow}>
                {filterOrder.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === option }}
                    key={option}
                    onPress={() => {
                      setFilter(option);
                    }}
                    style={({ pressed }) => [
                      deliveryStyles.methodOption,
                      filter === option && deliveryStyles.methodOptionSelected,
                      pressed && deliveryStyles.cardPressed,
                    ]}
                  >
                    <Text
                      style={[
                        deliveryStyles.methodOptionText,
                        filter === option &&
                          deliveryStyles.methodOptionTextSelected,
                      ]}
                    >
                      {filterLabels[option]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={deliveryStyles.card}>
                <TotalRow
                  label="Pago no período"
                  valueCents={courier.periodSettledCents}
                />
                <TotalRow
                  label="A pagar no período"
                  valueCents={
                    courier.periodPayoutCents - courier.periodSettledCents
                  }
                />
              </View>

              {courier.days.length === 0 ? (
                <Text style={deliveryStyles.empty}>
                  Nenhum dia registrado neste período.
                </Text>
              ) : (
                courier.days.map((day) => (
                  <Pressable
                    accessibilityRole="button"
                    key={day.id}
                    onPress={() => {
                      onOpenDay(day.id);
                    }}
                    style={({ pressed }) => [
                      deliveryStyles.card,
                      pressed && deliveryStyles.cardPressed,
                    ]}
                  >
                    <DayCard day={day} />
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCard({ day }: { day: DeliveryDaySummary }) {
  return (
    <>
      <View style={deliveryStyles.row}>
        <Text style={deliveryStyles.cardTitle}>{formatDate(day.openedAt)}</Text>
        <Text
          style={[
            deliveryStyles.badge,
            day.status === 'OPEN'
              ? deliveryStyles.badgeOpen
              : deliveryStyles.badgeClosed,
          ]}
        >
          {day.status === 'OPEN' ? 'Em aberto' : 'Fechado'}
        </Text>
      </View>
      <Text style={deliveryStyles.description}>
        {day.deliveryCount}{' '}
        {day.deliveryCount === 1 ? 'entrega' : 'entregas'} ·{' '}
        {formatCentsAsBrl(day.salesTotalCents)} vendidos
      </Text>
      <View style={deliveryStyles.divider} />
      <TotalRow label="Diária" valueCents={day.dailyRateCents} />
      <TotalRow label="Taxas" valueCents={day.feesTotalCents} />
      {day.expensesTotalCents > 0 ? (
        <TotalRow
          label="Despesas"
          negative
          valueCents={day.expensesTotalCents}
        />
      ) : null}
      <TotalRow
        emphasis
        label={day.status === 'OPEN' ? 'A pagar' : 'Pago'}
        valueCents={day.settlementPaidCents ?? day.payoutCents}
      />
    </>
  );
}
