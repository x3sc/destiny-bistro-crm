import { useCallback, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  loadTodayDashboard,
  type TodayDashboard,
} from '../services/dashboard-api';
import { formatCentsAsBrl } from '../services/money';
import { OperationalText as Text } from '../theme/operational-typography';
import { AppIcon } from './app-icon';

type DashboardState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { kind: 'success'; refreshedAt: Date; today: TodayDashboard };

export function MainMenuScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  bottomNavigation,
  canAccessAdmin = true,
  canAccessCredits = true,
  canAccessDeliveries = true,
  canAccessKitchen = true,
  canAccessTables = true,
  canAccessQuickSales = false,
  canReadSales = false,
  loadTodayRequest = loadTodayDashboard,
  onQuickSales,
  establishmentName,
  onAdmin,
  onCredits,
  onDeliveries,
  onKitchen,
  onLogout,
  onTables,
  userName,
}: {
  apiBaseUrl?: string;
  bottomNavigation?: ReactNode;
  canAccessAdmin?: boolean;
  canAccessCredits?: boolean;
  canAccessDeliveries?: boolean;
  canAccessKitchen?: boolean;
  canAccessTables?: boolean;
  canAccessQuickSales?: boolean;
  canReadSales?: boolean;
  loadTodayRequest?: typeof loadTodayDashboard;
  onQuickSales?: () => void;
  establishmentName?: string;
  onAdmin: () => void;
  onCredits: () => void;
  onDeliveries: () => void;
  onKitchen: () => void;
  onLogout?: () => void;
  onTables: () => void;
  userName?: string;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [dashboard, setDashboard] = useState<DashboardState>({
    kind: 'loading',
  });
  const refreshDashboard = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setDashboard({ kind: 'error' });
      return;
    }
    setDashboard({ kind: 'loading' });
    void loadTodayRequest(normalizedApiBaseUrl).then(
      (today) => {
        setDashboard({ kind: 'success', refreshedAt: new Date(), today });
      },
      () => {
        setDashboard({ kind: 'error' });
      },
    );
  }, [loadTodayRequest, normalizedApiBaseUrl]);

  useFocusEffect(refreshDashboard);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.brandRow}>
            <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
            {userName ? (
              <AppIcon
                color={themeColors.foregroundOnPrimary}
                name="user"
                size={58}
              />
            ) : null}
          </View>
          <Text fontRole="heading" style={styles.title}>
            {userName
              ? `Olá, bem-vindo(a), ${userName}, ao seu menu principal`
              : 'Olá, bem-vindo(a) ao seu menu principal'}
          </Text>
          {establishmentName ? (
            <Text style={styles.establishmentName}>{establishmentName}</Text>
          ) : null}
          {userName ? (
            <View style={styles.session}>
              <Text style={styles.sessionText}>Conectado como {userName}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onLogout}
                style={styles.logoutButton}
              >
                <Text style={styles.logout}>Sair</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>Escolha a área que deseja acessar</Text>

        <TodayPanel
          canReadKitchen={canAccessKitchen}
          canReadSales={canReadSales}
          canReadTables={canAccessTables}
          onRefresh={refreshDashboard}
          state={dashboard}
        />

        <View style={styles.cards}>
          {canAccessTables && (
            <MenuCard
              description="Abra e acompanhe as comandas do salão."
              icon="tables"
              label="Mesas"
              onPress={onTables}
            />
          )}
          {canAccessQuickSales && (
            <MenuCard description="Abra uma comanda pelo nome do cliente, sem mesa." icon="credits" label="Venda rápida" onPress={onQuickSales} />
          )}
          {canAccessCredits && (
            <MenuCard
              description="Registre pedidos e acompanhe valores a receber."
              icon="credits"
              label="Fiados"
              onPress={onCredits}
            />
          )}
          {canAccessDeliveries && (
            <MenuCard
              description="Organize pedidos, entregadores, entregas e o acerto do dia."
              icon="delivery"
              label="Delivery"
              onPress={onDeliveries}
            />
          )}
          {canAccessKitchen && (
            <MenuCard
              description="Acompanhe os itens enviados para preparo."
              icon="kitchen"
              label="Cozinha"
              onPress={onKitchen}
            />
          )}
          {canAccessAdmin && (
            <MenuCard
              description="Consulte o extrato do dia e gerencie categorias, itens e valores."
              icon="admin"
              label="Administrativo"
              onPress={onAdmin}
            />
          )}
        </View>
      </ScrollView>
      {bottomNavigation}
    </SafeAreaView>
  );
}

function TodayPanel({
  canReadKitchen,
  canReadSales,
  canReadTables,
  onRefresh,
  state,
}: {
  canReadKitchen: boolean;
  canReadSales: boolean;
  canReadTables: boolean;
  onRefresh: () => void;
  state: DashboardState;
}) {
  if (!canReadKitchen && !canReadSales && !canReadTables) {
    return null;
  }
  return (
    <View style={styles.todayPanel}>
      <View style={styles.todayHeading}>
        <View>
          <Text fontRole="heading" style={styles.todayTitle}>Hoje</Text>
          <Text style={styles.todayMeta}>
            {state.kind === 'success'
              ? `Atualizado às ${formatRefreshTime(state.refreshedAt)}`
              : 'Operação em tempo real'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Atualizar indicadores"
          accessibilityRole="button"
          disabled={state.kind === 'loading'}
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.refreshButton,
            state.kind === 'loading' && styles.disabledCard,
            pressed && styles.pressedCard,
          ]}
        >
          <Text style={styles.refreshLabel}>
            {state.kind === 'loading' ? 'Atualizando...' : 'Atualizar'}
          </Text>
        </Pressable>
      </View>
      {state.kind === 'error' && (
        <Text style={styles.dashboardError}>
          Sem conexão com a API. Os indicadores não estão disponíveis.
        </Text>
      )}
      {state.kind === 'loading' && (
        <Text style={styles.dashboardLoading}>Carregando indicadores...</Text>
      )}
      {state.kind === 'success' && (
        <View style={styles.metrics}>
          {canReadTables && state.today.occupiedTables !== null && (
            <MetricCard
              label="Mesas ocupadas"
              value={String(state.today.occupiedTables)}
            />
          )}
          {canReadKitchen &&
            state.today.pendingKitchenTickets !== null && (
              <MetricCard
                label="Cozinha pendente"
                value={String(state.today.pendingKitchenTickets)}
              />
            )}
          {canReadSales && state.today.closedSalesCents !== null && (
            <MetricCard
              label="Vendas fechadas"
              value={formatCentsAsBrl(state.today.closedSalesCents)}
            />
          )}
        </View>
      )}
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text fontRole="heading" style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatRefreshTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

function MenuCard({
  description,
  disabled = false,
  icon,
  label,
  onPress,
}: {
  description: string;
  disabled?: boolean;
  icon: 'admin' | 'credits' | 'delivery' | 'kitchen' | 'tables';
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.disabledCard,
        pressed && !disabled && styles.pressedCard,
      ]}
    >
      <View style={styles.cardHeading}>
        <AppIcon color={themeColors.accent} name={icon} size={22} />
        <Text
          adjustsFontSizeToFit
          fontRole="heading"
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.cardTitle}
        >
          {label}
        </Text>
        {disabled && <Text style={styles.badge}>Em breve</Text>}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: themeColors.surfaceAccent,
    borderRadius: 999,
    color: themeColors.primary,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    minHeight: 144,
    padding: 20,
  },
  cardDescription: {
    color: themeColors.foreground,
    fontSize: 15,
    lineHeight: 20,
  },
  cardHeading: {
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    color: themeColors.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cards: {
    gap: 16,
    marginTop: 14,
  },
  dashboardError: {
    backgroundColor: themeColors.dangerSurface,
    borderColor: themeColors.dangerBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: themeColors.dangerText,
    lineHeight: 20,
    padding: 14,
  },
  dashboardLoading: {
    color: themeColors.foregroundMuted,
    minHeight: 72,
    paddingVertical: 24,
    textAlign: 'center',
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 760,
    paddingBottom: 40,
    paddingHorizontal: 25,
    paddingTop: 26,
    width: '100%',
  },
  description: {
    color: themeColors.primary,
    fontSize: 17,
    paddingHorizontal: 25,
  },
  disabledCard: {
    opacity: 0.65,
  },
  eyebrow: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 16,
    fontWeight: '300',
  },
  establishmentName: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  logout: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
  },
  pressedCard: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  safeArea: {
    backgroundColor: themeColors.primary,
    flex: 1,
  },
  session: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sessionText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
  },
  title: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 34,
    maxWidth: 520,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: {
    backgroundColor: themeColors.primary,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
  },
  heroContent: {
    alignSelf: 'center',
    gap: 10,
    maxWidth: 760,
    paddingBottom: 22,
    paddingHorizontal: 26,
    paddingTop: 18,
    width: '100%',
  },
  metricCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: 140,
    flexGrow: 1,
    gap: 4,
    minHeight: 92,
    padding: 14,
  },
  metricLabel: {
    color: themeColors.foregroundMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  metricValue: {
    color: themeColors.primary,
    fontSize: 23,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  refreshButton: {
    alignItems: 'center',
    borderColor: themeColors.primary,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  refreshLabel: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  todayHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayMeta: {
    color: themeColors.foregroundMuted,
    fontSize: 12,
    marginTop: 2,
  },
  todayPanel: {
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.divider,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginTop: 18,
    padding: 16,
  },
  todayTitle: {
    color: themeColors.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
});
