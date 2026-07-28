import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  cancelComanda,
  changeComandaItemQuantity,
  closeComanda,
  confirmComandaItem,
  loadComanda,
  removeComandaItem,
  type Comanda,
} from '../services/comandas-api';
import {
  ActionButton,
  ComandaActions,
  ComandaItems,
  Message,
  statusLabels,
} from './comanda-details-parts';
import { styles } from './comanda-details-screen.styles';

interface ComandaDetailsScreenProps {
  apiBaseUrl?: string;
  cancelRequest?: typeof cancelComanda;
  changeItemQuantityRequest?: typeof changeComandaItemQuantity;
  closeRequest?: typeof closeComanda;
  comandaId: string;
  confirmItemRequest?: typeof confirmComandaItem;
  loadRequest?: typeof loadComanda;
  onAddProducts: (comandaId: string) => void;
  onBack: () => void;
  onCancelled: () => void;
  onClosed?: () => void;
  removeItemRequest?: typeof removeComandaItem;
}

type ComandaDetailsState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success' };

export function ComandaDetailsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  cancelRequest = cancelComanda,
  changeItemQuantityRequest = changeComandaItemQuantity,
  closeRequest = closeComanda,
  comandaId,
  confirmItemRequest = confirmComandaItem,
  loadRequest = loadComanda,
  onAddProducts,
  onBack,
  onCancelled,
  onClosed = onCancelled,
  removeItemRequest = removeComandaItem,
}: ComandaDetailsScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [isMutating, setIsMutating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
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

  useFocusEffect(refresh);

  const mutateComanda = async (request: Promise<Comanda>) => {
    setIsMutating(true);

    try {
      const comanda = await request;
      setState({ comanda, kind: 'success' });
    } catch {
      setState({ kind: 'error' });
    } finally {
      setIsMutating(false);
    }
  };

  const confirmCancellation = async () => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    setIsMutating(true);

    try {
      await cancelRequest(normalizedApiBaseUrl, comandaId);
      onCancelled();
    } catch {
      setState({ kind: 'error' });
      setIsMutating(false);
    }
  };

  const closeTable = async () => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    setIsClosing(true);
    setIsMutating(true);

    try {
      const closedComanda = await closeRequest(normalizedApiBaseUrl, comandaId);
      setState({ comanda: closedComanda, kind: 'success' });
      onClosed();
    } catch {
      setState({ kind: 'error' });
    } finally {
      setIsClosing(false);
      setIsMutating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
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
            <ComandaSummary comanda={state.comanda} />
            <ComandaItems
              comanda={state.comanda}
              disabled={isMutating}
              onChangeQuantity={(item, delta) => {
                if (!normalizedApiBaseUrl) {
                  return;
                }

                void mutateComanda(
                  changeItemQuantityRequest(
                    normalizedApiBaseUrl,
                    comandaId,
                    item.id,
                    delta,
                  ),
                );
              }}
              onConfirmItem={(item) => {
                if (normalizedApiBaseUrl) {
                  void mutateComanda(
                    confirmItemRequest(normalizedApiBaseUrl, comandaId, item.id),
                  );
                }
              }}
              onRemoveItem={(item) => {
                if (normalizedApiBaseUrl) {
                  void mutateComanda(removeItemRequest(normalizedApiBaseUrl, comandaId, item.id));
                }
              }}
            />
            <ComandaActions
              canCancel={state.comanda.items.length === 0}
              canClose={state.comanda.items.every(
                (item) => item.quantity === item.confirmedQuantity,
              )}
              disabled={isMutating}
              isClosing={isClosing}
              onAddProducts={() => {
                onAddProducts(comandaId);
              }}
              onBack={onBack}
              onCancel={() => {
                void confirmCancellation();
              }}
              onClose={() => {
                void closeTable();
              }}
              status={state.comanda.status}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ComandaSummary({ comanda }: { comanda: Comanda }) {
  return (
    <View style={styles.card}>
      <Text style={styles.comandaNumber}>Comanda #{comanda.number}</Text>
      {comanda.name && <Text style={styles.comandaName}>{comanda.name}</Text>}
      <Text style={styles.description}>Mesa {comanda.table.number}</Text>
      <Text style={styles.description}>Status: {statusLabels[comanda.status]}</Text>
      <Text style={styles.description}>Aberta em: {formatDateTime(comanda.openedAt)}</Text>
      {comanda.closedAt && (
        <Text style={styles.description}>Fechada em: {formatDateTime(comanda.closedAt)}</Text>
      )}
    </View>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}
