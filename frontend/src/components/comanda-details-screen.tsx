import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  cancelComanda,
  changeComandaItemQuantity,
  confirmComandaItem,
  loadComanda,
  removeComandaItem,
  type Comanda,
} from '../services/comandas-api';
import {
  cancelCreditOrder,
  finalizeCreditOrder,
} from '../services/credits-api';
import { themeColors } from '../theme/tokens';
import {
  ActionButton,
  ComandaActions,
  ComandaItems,
  Message,
  statusLabels,
} from './comanda-details-parts';
import { styles } from './comanda-details-screen.styles';
import { ScreenBackButton } from './screen-back-button';

interface ComandaDetailsScreenProps {
  apiBaseUrl?: string;
  cancelCreditRequest?: typeof cancelCreditOrder;
  cancelRequest?: typeof cancelComanda;
  changeItemQuantityRequest?: typeof changeComandaItemQuantity;
  comandaId: string;
  confirmItemRequest?: typeof confirmComandaItem;
  finalizeCreditRequest?: typeof finalizeCreditOrder;
  loadRequest?: typeof loadComanda;
  onAddProducts: (comandaId: string) => void;
  onBack: () => void;
  onCancelled: () => void;
  onCheckout?: (comanda: Comanda) => void;
  onCreditFinished?: (customerId: string) => void;
  readOnly?: boolean;
  removeItemRequest?: typeof removeComandaItem;
}

type ComandaDetailsState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success' };

export function ComandaDetailsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  cancelCreditRequest = cancelCreditOrder,
  cancelRequest = cancelComanda,
  changeItemQuantityRequest = changeComandaItemQuantity,
  comandaId,
  confirmItemRequest = confirmComandaItem,
  finalizeCreditRequest = finalizeCreditOrder,
  loadRequest = loadComanda,
  onAddProducts,
  onBack,
  onCancelled,
  onCheckout,
  onCreditFinished = onCancelled,
  readOnly = false,
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

  const cancelCreditDraft = async (comanda: Comanda) => {
    if (!normalizedApiBaseUrl || !comanda.credit) {
      return;
    }

    setIsMutating(true);

    try {
      await cancelCreditRequest(normalizedApiBaseUrl, comanda.credit.orderId);
      onCreditFinished(comanda.credit.customerId);
    } catch {
      setState({ kind: 'error' });
      setIsMutating(false);
    }
  };

  const finalizeCreditDraft = async (comanda: Comanda) => {
    if (!normalizedApiBaseUrl || !comanda.credit) {
      return;
    }

    setIsClosing(true);
    setIsMutating(true);

    try {
      await finalizeCreditRequest(normalizedApiBaseUrl, comanda.credit.orderId);
      onCreditFinished(comanda.credit.customerId);
    } catch {
      setState({ kind: 'error' });
      setIsClosing(false);
      setIsMutating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ComandaHeader
          comanda={state.kind === 'success' ? state.comanda : undefined}
          onBack={onBack}
        />

        {!normalizedApiBaseUrl && (
          <Message text="Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo." />
        )}
        {!comandaId && <Message text="Comanda inválida." />}

        {normalizedApiBaseUrl && comandaId && state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.description}>Carregando comanda...</Text>
          </View>
        )}

        {normalizedApiBaseUrl && comandaId && state.kind === 'error' && (
          <View style={styles.actions}>
            <Message text="Não foi possível carregar a comanda." />
            <ActionButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}

        {state.kind === 'success' && (
          <ComandaItems
            comanda={state.comanda}
            disabled={isMutating || readOnly}
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
        )}
      </ScrollView>

      {state.kind === 'success' && (
        <ComandaActions
          canCancel={state.comanda.items.length === 0}
          canClose={state.comanda.items.every(
            (item) => item.quantity === item.confirmedQuantity,
          )}
          canCreateCredit={
            state.comanda.items.length > 0 &&
            state.comanda.items.every(
              (item) => item.quantity === item.confirmedQuantity,
            )
          }
          credit={state.comanda.credit}
          disabled={isMutating}
          isClosing={isClosing}
          onAddProducts={() => {
            onAddProducts(comandaId);
          }}
          onCancel={() => {
            void confirmCancellation();
          }}
          onCancelCredit={() => {
            void cancelCreditDraft(state.comanda);
          }}
          onClose={() => {
            onCheckout?.(state.comanda);
          }}
          onFinalizeCredit={() => {
            void finalizeCreditDraft(state.comanda);
          }}
          status={state.comanda.status}
          readOnly={readOnly}
        />
      )}
    </SafeAreaView>
  );
}

function ComandaHeader({
  comanda,
  onBack,
}: {
  comanda?: Comanda;
  onBack: () => void;
}) {
  return (
    <View style={styles.screenHeader}>
      <ScreenBackButton onPress={onBack} />
      <View style={styles.headerCopy}>
        <View style={styles.contextRow}>
          <Text style={styles.eyebrow}>
            {comanda?.table ? `Mesa ${comanda.table.number}` : 'Destiny Bistro CRM'}
          </Text>
          {comanda?.name && <Text style={styles.contextName}>· {comanda.name}</Text>}
        </View>
        <Text style={styles.title}>
          {comanda ? `Comanda #${comanda.number}` : 'Detalhes da comanda'}
        </Text>
      </View>
      {comanda && (
        <Text
          style={[
            styles.statusBadge,
            comanda.status === 'OPEN' && styles.openStatusBadge,
            comanda.status === 'CLOSED' && styles.closedStatusBadge,
            comanda.status === 'CANCELLED' && styles.cancelledStatusBadge,
          ]}
        >
          • {statusLabels[comanda.status]}
        </Text>
      )}
    </View>
  );
}
