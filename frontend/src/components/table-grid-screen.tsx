import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  loadTables,
  type RestaurantTable,
  type RestaurantTableStatus,
} from '../services/tables-api';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { styles, tableStatusStyles } from './table-grid-screen.styles';

type TableGridState =
  | { apiBaseUrl: string; kind: 'error' }
  | { apiBaseUrl: string; kind: 'loading' }
  | { apiBaseUrl: string; kind: 'success'; tables: RestaurantTable[] };

interface TableGridScreenProps {
  apiBaseUrl?: string;
  loadTablesRequest?: typeof loadTables;
  onSelectTable?: (table: RestaurantTable) => void;
}
const tableStatusLabels: Record<RestaurantTableStatus, string> = {
  AWAITING_CHECK: 'Aguardando caixa',
  FREE: 'Livre',
  OPEN: 'Aberta',
};

export function TableGridScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  loadTablesRequest = loadTables,
  onSelectTable,
}: TableGridScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>Mesas</Text>
          <Text style={styles.description}>
            Acompanhe a situação atual das mesas do bistrô.
          </Text>
        </View>

        {!normalizedApiBaseUrl && (
          <MessageCard
            message="Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo."
            tone="error"
          />
        )}

        {visibleState?.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color="#6f4e37" size="large" />
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
            <FlatList
              columnWrapperStyle={styles.tableRow}
              contentContainerStyle={styles.tableGrid}
              data={visibleState.tables}
              keyExtractor={(table) => String(table.id)}
              numColumns={2}
              renderItem={({ item }) => (
                <TableCard onPress={onSelectTable} table={item} />
              )}
            />
            <RetryButton label="Atualizar mesas" onPress={refreshTables} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
function MessageCard({ message, tone = 'neutral' }: { message: string; tone?: 'error' | 'neutral' }) {
  return (
    <Text style={[styles.messageCard, tone === 'error' && styles.errorMessage]}>
      {message}
    </Text>
  );
}

function RetryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function TableCard({
  onPress,
  table,
}: {
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
        tableStatusStyles[table.status],
        pressed && isSelectable && styles.tableCardPressed,
      ]}
    >
      <Text style={styles.tableNumber}>Mesa {table.number}</Text>
      <Text style={styles.tableStatus}>{tableStatusLabels[table.status]}</Text>
      {table.activeComanda?.name && (
        <Text style={styles.comandaName}>{table.activeComanda.name}</Text>
      )}
      {table.activeComanda && (
        <Text style={styles.comandaNumber}>Comanda #{table.activeComanda.number}</Text>
      )}
    </Pressable>
  );
}
