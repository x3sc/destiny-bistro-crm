import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  loadTables,
  normalizeApiBaseUrl,
  type RestaurantTable,
  type RestaurantTableStatus,
} from '../services/tables-api';

type TableGridState =
  | { apiBaseUrl: string; kind: 'error' }
  | { apiBaseUrl: string; kind: 'loading' }
  | { apiBaseUrl: string; kind: 'success'; tables: RestaurantTable[] };

interface TableGridScreenProps {
  apiBaseUrl?: string;
  loadTablesRequest?: typeof loadTables;
}

const tableStatusLabels: Record<RestaurantTableStatus, string> = {
  AWAITING_CHECK: 'Aguardando caixa',
  FREE: 'Livre',
  OPEN: 'Aberta',
};

export function TableGridScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  loadTablesRequest = loadTables,
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

  useEffect(() => {
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
  }, [loadTablesRequest, normalizedApiBaseUrl]);

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
              renderItem={({ item }) => <TableCard table={item} />}
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

function TableCard({ table }: { table: RestaurantTable }) {
  return (
    <View style={[styles.tableCard, tableStatusStyles[table.status]]}>
      <Text style={styles.tableNumber}>Mesa {table.number}</Text>
      <Text style={styles.tableStatus}>{tableStatusLabels[table.status]}</Text>
    </View>
  );
}

const tableStatusStyles = StyleSheet.create({
  AWAITING_CHECK: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffca2c',
  },
  FREE: {
    backgroundColor: '#d1e7dd',
    borderColor: '#75b798',
  },
  OPEN: {
    backgroundColor: '#f8d7da',
    borderColor: '#ea868f',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f2eb',
  },
  content: {
    flex: 1,
    gap: 20,
    padding: 24,
  },
  heading: {
    gap: 8,
  },
  eyebrow: {
    color: '#795548',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#2f241f',
    fontSize: 32,
    fontWeight: '700',
  },
  description: {
    color: '#5d514b',
    fontSize: 16,
    lineHeight: 24,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  feedback: {
    gap: 16,
  },
  message: {
    color: '#5d514b',
    fontSize: 16,
  },
  messageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    color: '#5d514b',
    padding: 16,
  },
  errorMessage: {
    backgroundColor: '#f8d7da',
    color: '#842029',
  },
  tableGrid: {
    gap: 12,
  },
  tableRow: {
    gap: 12,
  },
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 108,
    padding: 16,
  },
  tableNumber: {
    color: '#2f241f',
    fontSize: 20,
    fontWeight: '700',
  },
  tableStatus: {
    color: '#5d514b',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 12,
    padding: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
