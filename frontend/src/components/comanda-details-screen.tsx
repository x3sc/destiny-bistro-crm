import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  cancelComanda,
  changeComandaItemQuantity,
  configureComandaItemAdditionals,
  confirmComandaItem,
  loadComanda,
  removeComandaItem,
  type Comanda,
} from '../services/comandas-api';
import { loadProducts, type Product } from '../services/products-api';
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
  const [additionalEditor, setAdditionalEditor] = useState<{
    additionals: NonNullable<Product['additionals']>;
    itemId: string;
    productName: string;
    quantity: string;
    selectedIds: string[];
  }>();
  const [actionMessage, setActionMessage] = useState<string>();

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
      setAdditionalEditor(undefined);
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
          <>
            {actionMessage ? <Message text={actionMessage} tone="notice" /> : null}
            {state.comanda.inventoryWarnings?.map((warning, index) => (
              <Message
                key={`${warning.type}-${warning.ingredientName ?? warning.productName}-${index}`}
                tone="notice"
                text={
                  warning.type === 'MISSING_RECIPE'
                    ? `${warning.productName ?? 'Produto'} está sem ficha técnica; a confirmação foi mantida.`
                    : `Estoque insuficiente de ${warning.ingredientName ?? 'insumo'}: faltam ${warning.missingQuantity ?? 0}.`
                }
              />
            ))}
            {additionalEditor && normalizedApiBaseUrl ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Adicionais · {additionalEditor.productName}</Text>
                <Text style={styles.description}>Escolha os adicionais e quantas unidades pendentes receberão essa configuração.</Text>
                {additionalEditor.additionals.map((additional) => {
                  const selected = additionalEditor.selectedIds.includes(additional.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={additional.id}
                      onPress={() => setAdditionalEditor((current) => current ? {
                        ...current,
                        selectedIds: selected
                          ? current.selectedIds.filter((id) => id !== additional.id)
                          : [...current.selectedIds, additional.id],
                      } : current)}
                      style={styles.additionalOption}
                    >
                      <Text style={styles.itemName}>{selected ? '✓ ' : ''}{additional.name}</Text>
                    </Pressable>
                  );
                })}
                <TextInput
                  accessibilityLabel="Quantidade de unidades com adicionais"
                  keyboardType="number-pad"
                  onChangeText={(quantity) => setAdditionalEditor((current) => current ? { ...current, quantity } : current)}
                  placeholder="Quantidade"
                  style={styles.input}
                  value={additionalEditor.quantity}
                />
                <View style={styles.actions}>
                  <ActionButton
                    disabled={isMutating || additionalEditor.selectedIds.length === 0}
                    label="Aplicar adicionais"
                    onPress={() => {
                      const quantity = Number(additionalEditor.quantity);
                      if (!Number.isInteger(quantity) || quantity <= 0) {
                        setActionMessage('Informe uma quantidade válida de unidades.');
                        return;
                      }
                      void mutateComanda(configureComandaItemAdditionals(
                        normalizedApiBaseUrl,
                        comandaId,
                        additionalEditor.itemId,
                        {
                          additionals: additionalEditor.selectedIds.map((additionalId) => ({ additionalId, quantityPerUnit: 1 })),
                          quantity,
                          requestId: `additional-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                        },
                      ));
                    }}
                  />
                  <ActionButton label="Cancelar" onPress={() => setAdditionalEditor(undefined)} tone="tertiary" />
                </View>
              </View>
            ) : null}
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
            onConfigureAdditionals={(item) => {
              if (!normalizedApiBaseUrl) return;
              setActionMessage(undefined);
              void loadProducts(normalizedApiBaseUrl).then(
                (products) => {
                  const additionals = products.find(({ id }) => id === item.productId)?.additionals ?? [];
                  if (additionals.length === 0) {
                    setActionMessage('Este produto não possui adicionais disponíveis.');
                    return;
                  }
                  setAdditionalEditor({
                    additionals,
                    itemId: item.id,
                    productName: item.productName,
                    quantity: '1',
                    selectedIds: [],
                  });
                },
                () => setActionMessage('Não foi possível carregar os adicionais.'),
              );
            }}
            onRemoveItem={(item) => {
              if (normalizedApiBaseUrl) {
                void mutateComanda(removeItemRequest(normalizedApiBaseUrl, comandaId, item.id));
              }
            }}
            />
          </>
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
