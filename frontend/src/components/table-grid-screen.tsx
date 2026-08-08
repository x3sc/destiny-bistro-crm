import { type ReactNode, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
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
  loadTables,
  type RestaurantTable,
  type RestaurantTableStatus,
} from '../services/tables-api';
import { themeColors } from '../theme/tokens';
import {
  styles,
  tableStatusBadgeStyles,
  tableStatusCardStyles,
} from './table-grid-screen.styles';
import { BrandedScreenHeader } from './branded-screen-header';
import { AppIcon } from './app-icon';

type TableGridState =
  | { apiBaseUrl: string; kind: 'error' }
  | { apiBaseUrl: string; kind: 'loading' }
  | { apiBaseUrl: string; kind: 'success'; tables: RestaurantTable[] };

type TableFilter = 'ALL' | 'AWAITING_CHECK' | 'FREE' | 'OPEN';

interface TableGridScreenProps {
  apiBaseUrl?: string;
  bottomNavigation?: ReactNode;
  loadTablesRequest?: typeof loadTables;
  onBack?: () => void;
  onSelectTable?: (table: RestaurantTable) => void;
}

const tableStatusLabels: Record<RestaurantTableStatus, string> = {
  AWAITING_CHECK: 'Aguardando pagamento',
  FREE: 'Livre',
  OPEN: 'Ocupada',
};

const filterOptions: { label: string; value: TableFilter }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Ocupadas', value: 'OPEN' },
  { label: 'Pagamento', value: 'AWAITING_CHECK' },
  { label: 'Livres', value: 'FREE' },
];

const CONTENT_MAX_WIDTH = 1180;
const CONTENT_HORIZONTAL_PADDING = 32;
const TABLE_CARD_MIN_WIDTH = 220;
const TABLE_GRID_GAP = 12;
const TABLE_GRID_MAX_COLUMNS = 4;

export function getTableGridMetrics(windowWidth: number) {
  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const availableWidth = Math.max(contentWidth - CONTENT_HORIZONTAL_PADDING, 0);
  const columnCount = Math.max(
    1,
    Math.min(
      TABLE_GRID_MAX_COLUMNS,
      Math.floor(
        (availableWidth + TABLE_GRID_GAP) /
          (TABLE_CARD_MIN_WIDTH + TABLE_GRID_GAP),
      ),
    ),
  );
  const cardWidth =
    (availableWidth - TABLE_GRID_GAP * (columnCount - 1)) / columnCount;

  return { cardWidth, columnCount };
}

export function TableGridScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  bottomNavigation,
  loadTablesRequest = loadTables,
  onBack,
  onSelectTable,
}: TableGridScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const { width: windowWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<TableFilter>('ALL');
  const [state, setState] = useState<TableGridState | undefined>(
    normalizedApiBaseUrl
      ? { apiBaseUrl: normalizedApiBaseUrl, kind: 'loading' }
      : undefined,
  );
  const visibleState =
    normalizedApiBaseUrl && state?.apiBaseUrl === normalizedApiBaseUrl
      ? state
      : normalizedApiBaseUrl
        ? { apiBaseUrl: normalizedApiBaseUrl, kind: 'loading' as const }
        : undefined;
  const { cardWidth, columnCount } = getTableGridMetrics(windowWidth);

  const refreshTables = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    setState({ apiBaseUrl: normalizedApiBaseUrl, kind: 'loading' });
    void loadTablesRequest(normalizedApiBaseUrl).then(
      (tables) => {
        setState({ apiBaseUrl: normalizedApiBaseUrl, kind: 'success', tables });
      },
      () => {
        setState({ apiBaseUrl: normalizedApiBaseUrl, kind: 'error' });
      },
    );
  }, [loadTablesRequest, normalizedApiBaseUrl]);

  useFocusEffect(
    useCallback(() => {
      if (!normalizedApiBaseUrl) {
        return;
      }

      let active = true;

      void loadTablesRequest(normalizedApiBaseUrl).then(
        (tables) => {
          if (active) {
            setState({ apiBaseUrl: normalizedApiBaseUrl, kind: 'success', tables });
          }
        },
        () => {
          if (active) {
            setState({ apiBaseUrl: normalizedApiBaseUrl, kind: 'error' });
          }
        },
      );

      return () => {
        active = false;
      };
    }, [loadTablesRequest, normalizedApiBaseUrl]),
  );

  const tables = visibleState?.kind === 'success' ? visibleState.tables : [];
  const normalizedSearchQuery = normalizeSearchText(searchQuery.trim());
  const filteredTables = tables.filter(
    (table) =>
      (selectedFilter === 'ALL' || table.status === selectedFilter) &&
      tableMatchesSearch(table, normalizedSearchQuery),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader onBack={onBack} title="Mesas" />
      <View style={styles.content}>
        {!normalizedApiBaseUrl && (
          <MessageCard
            message="Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo."
            tone="error"
          />
        )}

        {visibleState?.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.message}>Carregando mesas...</Text>
          </View>
        )}

        {visibleState?.kind === 'error' && (
          <View style={styles.feedback}>
            <MessageCard message="Não foi possível carregar as mesas." tone="error" />
            <RetryButton label="Tentar novamente" onPress={refreshTables} />
          </View>
        )}

        {visibleState?.kind === 'success' && visibleState.tables.length === 0 && (
          <View style={styles.feedback}>
            <MessageCard message="Nenhuma mesa cadastrada." />
            <RetryButton label="Atualizar mesas" onPress={refreshTables} />
          </View>
        )}

        {visibleState?.kind === 'success' && visibleState.tables.length > 0 && (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard
                count={tables.filter((table) => table.status === 'OPEN').length}
                label="Ocupadas"
              />
              <SummaryCard
                accessibilityLabel="Aguardando pagamento"
                count={
                  tables.filter((table) => table.status === 'AWAITING_CHECK').length
                }
                label="Aguardando pgto."
              />
              <SummaryCard
                count={tables.filter((table) => table.status === 'FREE').length}
                label="Livres"
              />
            </View>

            <View style={styles.searchField}>
              <AppIcon
                color={themeColors.icon}
                name="search"
                size={25}
              />
              <TextInput
                accessibilityLabel="Buscar mesa, nome ou comanda"
                accessibilityRole="search"
                onChangeText={setSearchQuery}
                placeholder="Buscar mesa, nome ou comanda..."
                placeholderTextColor={themeColors.placeholder}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            <View style={styles.filterBar} testID="table-filter-scroll">
              <ScrollView
                contentContainerStyle={styles.filterChips}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
              >
                {filterOptions.map((option) => (
                  <FilterChip
                    active={selectedFilter === option.value}
                    key={option.value}
                    label={option.label}
                    onPress={() => {
                      setSelectedFilter(option.value);
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            <FlatList
              columnWrapperStyle={columnCount > 1 ? styles.tableRow : undefined}
              contentContainerStyle={styles.tableGrid}
              data={filteredTables}
              key={`table-grid-${columnCount}`}
              keyExtractor={(table) => String(table.id)}
              ListEmptyComponent={
                <Text style={styles.emptyResults}>
                  Nenhuma mesa encontrada para os filtros selecionados.
                </Text>
              }
              numColumns={columnCount}
              renderItem={({ item }) => (
                <TableCard
                  cardWidth={cardWidth}
                  onPress={onSelectTable}
                  table={item}
                />
              )}
              style={styles.tableList}
            />
            <RetryButton label="Atualizar mesas" onPress={refreshTables} tone="secondary" />
          </>
        )}
      </View>
      {bottomNavigation}
    </SafeAreaView>
  );
}

function SummaryCard({
  accessibilityLabel,
  count,
  label,
}: {
  accessibilityLabel?: string;
  count: number;
  label: string;
}) {
  const announcedLabel = accessibilityLabel ?? label;

  return (
    <View
      accessibilityLabel={`${announcedLabel}: ${count}`}
      accessible
      style={styles.summaryCard}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{count}</Text>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.activeFilterChip,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          active && styles.activeFilterChipText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MessageCard({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'error' | 'neutral';
}) {
  return (
    <Text style={[styles.messageCard, tone === 'error' && styles.errorMessage]}>
      {message}
    </Text>
  );
}

function RetryButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'secondary' && styles.secondaryButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === 'secondary' && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TableCard({
  cardWidth,
  onPress,
  table,
}: {
  cardWidth: number;
  onPress?: (table: RestaurantTable) => void;
  table: RestaurantTable;
}) {
  const isSelectable = table.status === 'FREE' || !!table.activeComanda;

  return (
    <Pressable
      accessibilityLabel={`Mesa ${table.number} ${tableStatusLabels[table.status]}${
        table.activeComanda
          ? `${table.activeComanda.name ? ` ${table.activeComanda.name}` : ''} Comanda #${table.activeComanda.number}`
          : ''
      }`}
      accessibilityRole="button"
      disabled={!isSelectable}
      onPress={() => {
        onPress?.(table);
      }}
      style={({ pressed }) => [
        styles.tableCard,
        tableStatusCardStyles[table.status],
        { width: cardWidth },
        pressed && isSelectable && styles.tableCardPressed,
      ]}
    >
      <View style={styles.tableCardHeading}>
        <Text style={styles.tableNumber}>Mesa {table.number}</Text>
        <Text
          style={[
            styles.tableStatus,
            tableStatusBadgeStyles[table.status],
          ]}
        >
          • {tableStatusLabels[table.status]}
        </Text>
      </View>
      {table.activeComanda?.name && (
        <Text style={styles.comandaName}>{table.activeComanda.name}</Text>
      )}
      {table.activeComanda ? (
        <Text style={styles.comandaNumber}>
          Comanda #{table.activeComanda.number}
        </Text>
      ) : table.status === 'FREE' ? (
        <Text style={styles.openComandaAction}>＋ Abrir comanda</Text>
      ) : null}
    </Pressable>
  );
}

function tableMatchesSearch(table: RestaurantTable, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const searchableValues = [
    `mesa ${table.number}`,
    String(table.number),
    table.activeComanda?.name ?? '',
    table.activeComanda ? `comanda ${table.activeComanda.number}` : '',
    table.activeComanda ? String(table.activeComanda.number) : '',
  ];

  return searchableValues.some((value) =>
    normalizeSearchText(value).includes(normalizedQuery),
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}
