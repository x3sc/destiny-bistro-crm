import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  cancelComanda,
  loadComanda,
  type Comanda,
} from '../services/comandas-api';

interface ComandaDetailsScreenProps {
  apiBaseUrl?: string;
  cancelRequest?: typeof cancelComanda;
  comandaId: string;
  loadRequest?: typeof loadComanda;
  onBack: () => void;
  onCancelled: () => void;
}

type ComandaDetailsState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success' };

export function ComandaDetailsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  cancelRequest = cancelComanda,
  comandaId,
  loadRequest = loadComanda,
  onBack,
  onCancelled,
}: ComandaDetailsScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [isCancellationConfirmed, setIsCancellationConfirmed] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [state, setState] = useState<ComandaDetailsState>({ kind: 'loading' });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, comandaId).then(
      (comanda) => {
        setState({ comanda, kind: 'success' });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [comandaId, loadRequest, normalizedApiBaseUrl]);

  useEffect(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      return;
    }

    let active = true;

    void loadRequest(normalizedApiBaseUrl, comandaId).then(
      (comanda) => {
        if (active) {
          setState({ comanda, kind: 'success' });
        }
      },
      () => {
        if (active) {
          setState({ kind: 'error' });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [comandaId, loadRequest, normalizedApiBaseUrl]);

  const confirmCancellation = async () => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    setIsCancelling(true);

    try {
      await cancelRequest(normalizedApiBaseUrl, comandaId);
      onCancelled();
    } catch {
      setIsCancelling(false);
      setIsCancellationConfirmed(false);
      setState({ kind: 'error' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
        <Text style={styles.title}>Detalhes da comanda</Text>

        {!normalizedApiBaseUrl && (
          <Message text="Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo." />
        )}

        {!comandaId && <Message text="Comanda inválida." />}

        {normalizedApiBaseUrl && comandaId && state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color="#6f4e37" size="large" />
            <Text style={styles.description}>Carregando comanda...</Text>
          </View>
        )}

        {normalizedApiBaseUrl && comandaId && state.kind === 'error' && (
          <View style={styles.actions}>
            <Message text="Não foi possível carregar a comanda." />
            <ActionButton label="Tentar novamente" onPress={refresh} />
            <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
          </View>
        )}

        {state.kind === 'success' && (
          <>
            <View style={styles.card}>
              <Text style={styles.comandaNumber}>Comanda #{state.comanda.number}</Text>
              <Text style={styles.description}>Mesa {state.comanda.table.number}</Text>
              <Text style={styles.description}>Status: {statusLabels[state.comanda.status]}</Text>
              <Text style={styles.description}>
                Aberta em: {formatDateTime(state.comanda.openedAt)}
              </Text>
            </View>

            {state.comanda.status === 'OPEN' && !isCancellationConfirmed && (
              <View style={styles.actions}>
                <ActionButton
                  label="Cancelar comanda vazia"
                  onPress={() => {
                    setIsCancellationConfirmed(true);
                  }}
                  tone="danger"
                />
                <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
              </View>
            )}

            {state.comanda.status === 'OPEN' && isCancellationConfirmed && (
              <View style={styles.actions}>
                <Message text="Confirme o cancelamento. Esta ação libera a mesa e só é permitida para comandas vazias." />
                <ActionButton
                  disabled={isCancelling}
                  label={isCancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
                  onPress={() => {
                    void confirmCancellation();
                  }}
                  tone="danger"
                />
                <ActionButton
                  disabled={isCancelling}
                  label="Voltar"
                  onPress={() => {
                    setIsCancellationConfirmed(false);
                  }}
                  tone="secondary"
                />
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const statusLabels: Record<Comanda['status'], string> = {
  CANCELLED: 'Cancelada',
  OPEN: 'Aberta',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function Message({ text }: { text: string }) {
  return <Text style={styles.error}>{text}</Text>;
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
  tone?: 'danger' | 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' && styles.dangerButton,
        tone === 'secondary' && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonText, tone === 'secondary' && styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 8,
    padding: 20,
  },
  comandaNumber: {
    color: '#2f241f',
    fontSize: 24,
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
  actions: {
    gap: 12,
  },
  error: {
    backgroundColor: '#f8d7da',
    borderRadius: 12,
    color: '#842029',
    padding: 16,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 12,
    padding: 16,
  },
  dangerButton: {
    backgroundColor: '#842029',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#6f4e37',
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#6f4e37',
  },
});
