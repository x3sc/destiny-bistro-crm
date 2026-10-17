import { useCallback, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  loadTodayDashboard,
  type TodayDashboard,
} from '../services/dashboard-api';
import { formatCentsAsBrl } from '../services/money';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors, themeRadii, themeSpacing } from '../theme/tokens';
import { AppIcon, type AppIconName } from './app-icon';

type DashboardState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { kind: 'success'; today: TodayDashboard };

export interface OperationalMainMenuScreenProps {
  apiBaseUrl?: string;
  bottomNavigation?: ReactNode;
  canAccessAdmin?: boolean;
  canAccessCredits?: boolean;
  canAccessDeliveries?: boolean;
  canAccessKitchen?: boolean;
  canAccessQuickSales?: boolean;
  canAccessCounterSales?: boolean;
  canAccessTables?: boolean;
  canReadSales?: boolean;
  establishmentName?: string;
  loadTodayRequest?: typeof loadTodayDashboard;
  onAdmin: () => void;
  onCredits: () => void;
  onDeliveries: () => void;
  onKitchen: () => void;
  onLogout?: () => void;
  onQuickSales?: () => void;
  onCounterSales?: () => void;
  onTables: () => void;
  userName?: string;
}

export function OperationalMainMenuScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  bottomNavigation,
  canAccessAdmin = true,
  canAccessCredits = true,
  canAccessDeliveries = true,
  canAccessKitchen = true,
  canAccessQuickSales = false,
  canAccessCounterSales = false,
  canAccessTables = true,
  canReadSales = false,
  establishmentName,
  loadTodayRequest = loadTodayDashboard,
  onAdmin,
  onCredits,
  onDeliveries,
  onKitchen,
  onLogout,
  onQuickSales,
  onCounterSales,
  onTables,
  userName,
}: OperationalMainMenuScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [dashboard, setDashboard] = useState<DashboardState>({ kind: 'loading' });

  const refreshDashboard = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setDashboard({ kind: 'error' });
      return;
    }
    setDashboard({ kind: 'loading' });
    void loadTodayRequest(normalizedApiBaseUrl).then(
      (today) => setDashboard({ kind: 'success', today }),
      () => setDashboard({ kind: 'error' }),
    );
  }, [loadTodayRequest, normalizedApiBaseUrl]);

  useFocusEffect(refreshDashboard);
  const today = dashboard.kind === 'success' ? dashboard.today : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <BrandHeader establishmentName={establishmentName} />
          <OperatorHeader
            onLogout={onLogout}
            userName={userName}
          />
          <View style={styles.shiftBar}>
            <AppIcon color={themeColors.accent} name="store" size={17} />
            <Text numberOfLines={1} style={styles.shiftText}>
              Turno ativo · {establishmentName ?? 'Salão aberto'}
            </Text>
          </View>
          <TodayPanel
            canReadKitchen={canAccessKitchen}
            canReadSales={canReadSales}
            canReadTables={canAccessTables}
            onRefresh={refreshDashboard}
            state={dashboard}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modulesHeading}>
          <Text fontRole="heading" style={styles.modulesTitle}>
            Módulos operacionais
          </Text>
          <Text style={styles.modulesHint}>Toque para acessar</Text>
        </View>

        <View style={styles.modules}>
          {canAccessTables ? (
            <ModuleRow
              badge={metricBadge(today?.occupiedTables, 'em atendimento')}
              description="Mapa de mesas, abertura e comandas do salão."
              icon="tables"
              tone="wine"
              label="Mesas"
              onPress={onTables}
            />
          ) : null}
          {canAccessCounterSales ? (
            <ModuleRow description="Comandas com pagamento registrado no caixa externo." icon="store" tone="gold" label="Balcão" onPress={onCounterSales} />
          ) : null}
          {canAccessQuickSales ? (
            <ModuleRow
              description="Atendimento expresso direto ao cliente."
              icon="quickSale"
              tone="gold"
              label="Venda rápida"
              onPress={onQuickSales}
            />
          ) : null}
          {canAccessCredits ? (
            <ModuleRow
              description="Pedidos vinculados e valores a receber."
              icon="credits"
              tone="cream"
              label="Fiados"
              onPress={onCredits}
            />
          ) : null}
          {canAccessDeliveries ? (
            <ModuleRow
              description="Pedidos, despachos, entregadores e acertos."
              icon="delivery"
              tone="green"
              label="Delivery"
              onPress={onDeliveries}
            />
          ) : null}
          {canAccessKitchen ? (
            <ModuleRow
              accessibilityLabel="Cozinha"
              badge={metricBadge(today?.pendingKitchenTickets, 'pendentes')}
              description="Fila de preparo e itens enviados à cozinha."
              icon="kitchen"
              tone="wine"
              label="Cozinha (KDS)"
              onPress={onKitchen}
            />
          ) : null}
          {canAccessAdmin ? (
            <ModuleRow
              description="Extrato, cardápio, estoque e equipe."
              icon="admin"
              tone="wine"
              label="Administrativo"
              onPress={onAdmin}
            />
          ) : null}
        </View>

        <View style={styles.experienceCard}>
          <View style={styles.experienceIcon}>
            <AppIcon color={themeColors.accent} name="restaurant" size={24} />
          </View>
          <View style={styles.flexCopy}>
            <Text fontRole="heading" style={styles.experienceTitle}>
              Destiny Bistro Experience
            </Text>
            <Text style={styles.experienceDescription}>
              Operação clara e atendimento cuidadoso em cada pedido.
            </Text>
          </View>
        </View>
      </ScrollView>
      {bottomNavigation}
    </SafeAreaView>
  );
}

function BrandHeader({ establishmentName }: { establishmentName?: string }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandIdentity}>
        <View style={styles.brandMark}>
          <AppIcon color={themeColors.primary} name="kitchen" size={20} />
        </View>
        <View style={styles.flexCopy}>
          <Text fontRole="heading" style={styles.brandName}>
            Destiny Bistro CRM
          </Text>
          <Text style={styles.brandContext}>
            {establishmentName ?? 'Operação'}
          </Text>
        </View>
      </View>
      <View style={styles.profileIcon}>
        <AppIcon
          color={themeColors.foregroundOnPrimary}
          name="user"
          size={20}
        />
      </View>
    </View>
  );
}

function OperatorHeader({
  onLogout,
  userName,
}: {
  onLogout?: () => void;
  userName?: string;
}) {
  return (
    <View style={styles.operatorRow}>
      <View style={styles.avatar}>
        <Text fontRole="heading" style={styles.avatarText}>
          {initialsFor(userName)}
        </Text>
      </View>
      <View style={styles.operatorCopy}>
        <View style={styles.operatorNameRow}>
          <Text fontRole="heading" numberOfLines={1} style={styles.operatorName}>
            {userName ? `Olá, ${userName}.` : 'Olá, seja bem-vindo(a).'}
          </Text>
          <View accessibilityLabel="Conectado" style={styles.onlineDot} />
        </View>
        <Text style={styles.operatorRole}>Operador conectado</Text>
      </View>
      {userName ? (
        <Pressable
          accessibilityLabel="Sair"
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Text style={styles.logoutText}>Sair</Text>
          <AppIcon
            color={themeColors.foregroundOnPrimary}
            name="logout"
            size={15}
          />
        </Pressable>
      ) : null}
    </View>
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
        <Text fontRole="heading" style={styles.todayTitle}>Pulso do turno</Text>
        <Pressable
          accessibilityLabel="Atualizar indicadores"
          accessibilityRole="button"
          disabled={state.kind === 'loading'}
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.liveStatus,
            state.kind === 'loading' && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {state.kind === 'loading' ? 'Atualizando' : 'Em tempo real'}
          </Text>
        </Pressable>
      </View>

      {state.kind === 'error' ? (
        <View style={styles.dashboardError}>
          <Text style={styles.dashboardErrorText}>
            Sem conexão. Os indicadores não estão disponíveis.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRefresh}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.metrics}>
          {canReadTables ? (
            <MetricCard
              label="Mesas ocupadas"
              loading={state.kind === 'loading'}
              value={dashboardValue(state, 'occupiedTables')}
            />
          ) : null}
          {canReadKitchen ? (
            <MetricCard
              emphasis="gold"
              label="Na cozinha"
              loading={state.kind === 'loading'}
              value={dashboardValue(state, 'pendingKitchenTickets')}
            />
          ) : null}
          {canReadSales ? (
            <MetricCard
              label="Vendas fechadas"
              loading={state.kind === 'loading'}
              value={salesValue(state)}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function MetricCard({
  emphasis = 'neutral',
  label,
  loading,
  value,
}: {
  emphasis?: 'gold' | 'neutral';
  label: string;
  loading: boolean;
  value: string;
}) {
  return (
    <View
      accessibilityLabel={loading ? `${label}: carregando` : `${label}: ${value}`}
      style={[styles.metricCard, emphasis === 'gold' && styles.metricCardGold]}
    >
      <Text fontRole="heading" style={styles.metricValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

type ModuleTone = 'cream' | 'gold' | 'green' | 'wine';

function ModuleRow({
  accessibilityLabel,
  badge,
  description,
  icon,
  label,
  onPress,
  tone,
}: {
  accessibilityLabel?: string;
  badge?: string;
  description: string;
  icon: AppIconName;
  label: string;
  onPress?: () => void;
  tone: ModuleTone;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.moduleRow, pressed && styles.pressedRow]}
    >
      <View style={[styles.moduleIcon, moduleIconStyles[tone]]}>
        <AppIcon color={moduleIconColors[tone]} name={icon} size={19} />
      </View>
      <View style={styles.moduleCopy}>
        <View style={styles.moduleTitleRow}>
          <Text fontRole="heading" numberOfLines={1} style={styles.moduleTitle}>{label}</Text>
          {badge ? (
            <View style={styles.moduleBadge}>
              <Text numberOfLines={1} style={styles.moduleBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.moduleDescription}>{description}</Text>
      </View>
      <AppIcon color={themeColors.placeholder} name="next" size={15} />
    </Pressable>
  );
}

function dashboardValue(
  state: DashboardState,
  key: 'occupiedTables' | 'pendingKitchenTickets',
) {
  if (state.kind !== 'success' || state.today[key] === null) {
    return '—';
  }
  return String(state.today[key]);
}

function salesValue(state: DashboardState) {
  if (state.kind !== 'success' || state.today.closedSalesCents === null) {
    return '—';
  }
  return formatCentsAsBrl(state.today.closedSalesCents).replace(/\u00a0/g, ' ');
}

function metricBadge(value: number | null | undefined, suffix: string) {
  return typeof value === 'number' ? `${value} ${suffix}` : undefined;
}

function initialsFor(name?: string) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) {
    return 'DB';
  }
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

const moduleIconColors: Record<ModuleTone, string> = {
  cream: '#7b5804',
  gold: themeColors.primary,
  green: themeColors.statusFreeText,
  wine: themeColors.primary,
};

const moduleIconStyles = StyleSheet.create({
  cream: { backgroundColor: themeColors.surfaceAccent },
  gold: { backgroundColor: '#fdcd74' },
  green: { backgroundColor: themeColors.statusFreeSurface },
  wine: { backgroundColor: themeColors.statusOpenSurface },
});

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: '#fdcd74', borderRadius: themeRadii.pill, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: themeColors.primary, fontSize: 14, fontWeight: '800' },
  brandContext: { color: '#f6cf7e', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  brandIdentity: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 10 },
  brandMark: { alignItems: 'center', backgroundColor: themeColors.surface, borderRadius: 10, height: 40, justifyContent: 'center', width: 40 },
  brandName: { color: themeColors.foregroundOnPrimary, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  content: { alignSelf: 'center', flexGrow: 1, maxWidth: 760, paddingBottom: 30, paddingHorizontal: themeSpacing.mobileMargin, width: '100%' },
  dashboardError: { alignItems: 'center', backgroundColor: themeColors.dangerSurface, borderColor: themeColors.dangerBorder, borderRadius: themeRadii.operationalControl, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'space-between', minHeight: 72, padding: 12 },
  dashboardErrorText: { color: themeColors.dangerText, flex: 1, fontSize: 12, lineHeight: 16 },
  disabled: { opacity: 0.58 },
  experienceCard: { alignItems: 'center', backgroundColor: themeColors.surfaceAccent, borderRadius: themeRadii.operationalCard, flexDirection: 'row', gap: 12, marginTop: themeSpacing.lg, padding: 12 },
  experienceDescription: { color: themeColors.foregroundMuted, fontSize: 12, lineHeight: 16 },
  experienceIcon: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: themeRadii.operationalControl, height: 52, justifyContent: 'center', width: 52 },
  experienceTitle: { color: themeColors.foreground, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  flexCopy: { flex: 1, gap: 2, minWidth: 0 },
  hero: { backgroundColor: themeColors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 20 },
  heroContent: { alignSelf: 'center', gap: 16, maxWidth: 760, paddingHorizontal: themeSpacing.mobileMargin, paddingTop: 8, width: '100%' },
  liveDot: { backgroundColor: themeColors.statusFreeText, borderRadius: themeRadii.pill, height: 6, width: 6 },
  liveStatus: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: themeSpacing.touchTargetMin, paddingLeft: 8 },
  liveText: { color: themeColors.statusFreeText, fontSize: 12, fontWeight: '700' },
  logoutButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: themeRadii.operationalControl, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: themeSpacing.touchTargetMin, paddingHorizontal: 13 },
  logoutText: { color: themeColors.foregroundOnPrimary, fontSize: 12, fontWeight: '800' },
  metricCard: { alignItems: 'center', backgroundColor: '#f7f2f2', borderRadius: themeRadii.operationalControl, flex: 1, gap: 2, justifyContent: 'center', minHeight: 72, minWidth: 82, paddingHorizontal: 5, paddingVertical: 8 },
  metricCardGold: { backgroundColor: '#fff1c9' },
  metricLabel: { color: themeColors.foregroundMuted, fontSize: 11, fontWeight: '600', lineHeight: 14, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 8 },
  metricValue: { color: themeColors.primary, fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '800', lineHeight: 22 },
  moduleBadge: { backgroundColor: themeColors.statusOpenSurface, borderRadius: themeRadii.pill, flexShrink: 1, paddingHorizontal: 8, paddingVertical: 2 },
  moduleBadgeText: { color: themeColors.statusOpenText, fontSize: 11, fontWeight: '700' },
  moduleCopy: { flex: 1, gap: 3, minWidth: 0 },
  moduleDescription: { color: themeColors.foregroundMuted, fontSize: 12, lineHeight: 16 },
  moduleIcon: { alignItems: 'center', borderRadius: themeRadii.operationalControl, height: 44, justifyContent: 'center', width: 44 },
  moduleRow: { alignItems: 'center', backgroundColor: themeColors.surface, borderBottomColor: '#f0eded', borderBottomWidth: 1, borderRadius: themeRadii.operationalCard, flexDirection: 'row', gap: 12, minHeight: 72, paddingHorizontal: 12, paddingVertical: 10 },
  modules: { gap: 8 },
  modulesHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, marginTop: 22 },
  modulesHint: { color: themeColors.foregroundMuted, fontSize: 12 },
  modulesTitle: { color: themeColors.foreground, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  moduleTitle: { color: themeColors.foreground, flexShrink: 1, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  moduleTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  onlineDot: { backgroundColor: '#72a469', borderRadius: themeRadii.pill, height: 7, width: 7 },
  operatorCopy: { flex: 1, minWidth: 0 },
  operatorName: { color: themeColors.foregroundOnPrimary, flexShrink: 1, fontSize: 19, fontWeight: '800', lineHeight: 24 },
  operatorNameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  operatorRole: { color: '#f6cf7e', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  operatorRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  pressed: { opacity: 0.76 },
  pressedRow: { backgroundColor: themeColors.surfaceMuted },
  profileIcon: { alignItems: 'center', borderRadius: themeRadii.pill, height: themeSpacing.touchTargetMin, justifyContent: 'center', width: themeSpacing.touchTargetMin },
  retryButton: { alignItems: 'center', borderColor: themeColors.dangerText, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: themeSpacing.touchTargetMin, paddingHorizontal: 10 },
  retryText: { color: themeColors.dangerText, fontSize: 11, fontWeight: '800' },
  safeArea: { backgroundColor: themeColors.background, flex: 1 },
  shiftBar: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: themeRadii.operationalControl, flexDirection: 'row', gap: 8, minHeight: themeSpacing.touchTargetMin, paddingHorizontal: 12 },
  shiftText: { color: themeColors.foregroundOnPrimary, flex: 1, fontSize: 12, fontWeight: '700' },
  todayHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  todayPanel: { backgroundColor: themeColors.surface, borderRadius: themeRadii.operationalCard, gap: 8, padding: 12 },
  todayTitle: { color: themeColors.foregroundMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.3, lineHeight: 16 },
});
