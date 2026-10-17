import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import { formatOperationalDateTime } from '../services/date-time';
import {
  cancelComanda,
  cancelComandaItemConfiguration,
  changeComandaItemQuantity,
  configureComandaItemAdditionals,
  confirmComandaItem,
  loadComanda,
  removeComandaItem,
  setComandaItemPendingQuantity,
  type Comanda,
  type ComandaItem,
  type ComandaItemConfiguration,
  type InventoryWarning,
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
  ComandaCancellationAction,
  ComandaItems,
  Message,
  statusLabels,
} from './comanda-details-parts';
import { styles } from './comanda-details-screen.styles';
import { ScreenBackButton } from './screen-back-button';
import { ThermalPrintSection } from './thermal-print-section';
import { comandaNavigationResource, useNavigationGuard } from '../navigation/safe-navigation';

interface ComandaDetailsScreenProps {
  canOperate?: (comanda: Comanda) => boolean;
  apiBaseUrl?: string;
  cancelCreditRequest?: typeof cancelCreditOrder;
  canPrint?: boolean;
  cancelRequest?: typeof cancelComanda;
  canCancelConfirmed?: boolean;
  changeItemQuantityRequest?: typeof changeComandaItemQuantity;
  comandaId: string;
  confirmItemRequest?: typeof confirmComandaItem;
  finalizeCreditRequest?: typeof finalizeCreditOrder;
  initialInventoryWarnings?: InventoryWarning[];
  loadRequest?: typeof loadComanda;
  onAddProducts: (comandaId: string) => void;
  onBack: () => void;
  onCancelled: () => void;
  onCheckout?: (comanda: Comanda) => void;
  onEditCounterName?: (comanda: Comanda) => void;
  onCreditFinished?: (customerId: string) => void;
  readOnly?: boolean;
  removeItemRequest?: typeof removeComandaItem;
  setItemPendingQuantityRequest?: typeof setComandaItemPendingQuantity;
}

const emptyInventoryWarnings: InventoryWarning[] = [];

type ComandaDetailsState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success' };

export function ComandaDetailsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  cancelCreditRequest = cancelCreditOrder,
  cancelRequest = cancelComanda,
  canCancelConfirmed = false,
  canPrint = false,
  changeItemQuantityRequest = changeComandaItemQuantity,
  comandaId,
  confirmItemRequest = confirmComandaItem,
  finalizeCreditRequest = finalizeCreditOrder,
  initialInventoryWarnings = emptyInventoryWarnings,
  loadRequest = loadComanda,
  onAddProducts,
  onBack,
  onCancelled,
  onCheckout,
  onEditCounterName,
  onCreditFinished = onCancelled,
  readOnly = false,
  canOperate = () => true,
  removeItemRequest = removeComandaItem,
  setItemPendingQuantityRequest = setComandaItemPendingQuantity,
}: ComandaDetailsScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [isMutating, setIsMutating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [state, setState] = useState<ComandaDetailsState>({ kind: 'loading' });
  const [additionalEditor, setAdditionalEditor] = useState<{
    additionals: NonNullable<Product['additionals']>;
    itemId: string;
    productName: string;
    quantity: string;
    selectedIds: string[];
  }>();
  const [actionMessage, setActionMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [cancellationEditor, setCancellationEditor] = useState<{
    configuration: ComandaItemConfiguration;
    disposition: 'RETURN_TO_STOCK' | 'LOSS';
    item: ComandaItem;
    quantity: string;
    reason: string;
    requestId: string;
  }>();
  const [totalCancellationEditor, setTotalCancellationEditor] = useState<{
    disposition: 'RETURN_TO_STOCK' | 'LOSS';
    hasConfirmedItems: boolean;
    reason: string;
    requestId: string;
  }>();

  useNavigationGuard({ busy: isMutating || isClosing,
    resource: state.kind === 'success' ? comandaNavigationResource(state.comanda) : undefined,
    closeModal: totalCancellationEditor ? () => setTotalCancellationEditor(undefined) :
      cancellationEditor ? () => setCancellationEditor(undefined) : additionalEditor ? () => setAdditionalEditor(undefined) : undefined,
  });
  readOnly = readOnly || (state.kind === 'success' && !canOperate(state.comanda));
  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, comandaId).then(
      (comanda) => {
        setState({
          comanda:
            initialInventoryWarnings.length > 0
              ? { ...comanda, inventoryWarnings: initialInventoryWarnings }
              : comanda,
          kind: 'success',
        });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [
    comandaId,
    initialInventoryWarnings,
    loadRequest,
    normalizedApiBaseUrl,
  ]);

  useFocusEffect(refresh);

  const mutateComanda = async (request: Promise<Comanda>, failureMessage?: string) => {
    setIsMutating(true);

    setActionError(undefined);
    try {
      const comanda = await request;
      setState({ comanda, kind: 'success' });
      setAdditionalEditor(undefined);
      setCancellationEditor(undefined);
      setTotalCancellationEditor(undefined);
    } catch {
      if (failureMessage) {
        setActionError(failureMessage);
      } else {
        setState({ kind: 'error' });
      }
    } finally {
      setIsMutating(false);
    }
  };

  const confirmCancellation = async () => {
    if (!normalizedApiBaseUrl) {
      return;
    }

    setIsMutating(true);
    setActionError(undefined);

    const cancellationInput = totalCancellationEditor
      ? {
          ...(totalCancellationEditor.hasConfirmedItems
            ? { disposition: totalCancellationEditor.disposition }
            : {}),
          reason: totalCancellationEditor.reason,
          requestId: totalCancellationEditor.requestId,
        }
      : undefined;

    try {
      if (cancellationInput) {
        await cancelRequest(normalizedApiBaseUrl, comandaId, cancellationInput);
      } else {
        await cancelRequest(normalizedApiBaseUrl, comandaId);
      }
      onCancelled();
    } catch {
      setActionError('Não foi possível cancelar a comanda. Tente novamente.');
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

  const counterPrintActions = (stage: 'pending' | 'final') => {
    if (state.kind !== 'success' || !normalizedApiBaseUrl || state.comanda.tableName !== 'Balcão' || state.comanda.credit) return null;
    return <ThermalPrintSection
      key={JSON.stringify(state.comanda)}
      apiBaseUrl={normalizedApiBaseUrl}
      canPrint={canPrint}
      comandaId={comandaId}
      counterSale={state.comanda}
      counterStage={stage}
      disabled={isMutating}
      onConflict={refresh}
    />;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerHeight + 20 },
        ]}
        style={styles.scroll}
        testID="comanda-scroll"
      >
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
            {onEditCounterName && !readOnly && state.comanda.status === 'OPEN' && state.comanda.tableName === 'Balcão' && (
              <ActionButton label={state.comanda.name ? 'Editar identificação' : 'Identificação opcional'}
                onPress={() => onEditCounterName(state.comanda)} tone="secondary" />
            )}
            {actionError ? <Message text={actionError} /> : null}
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
                <Text fontRole="heading" style={styles.sectionTitle}>Adicionais · {additionalEditor.productName}</Text>
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
            {cancellationEditor && normalizedApiBaseUrl ? (
              <View style={[styles.card, styles.cancellationEditorScreen]} testID="item-cancellation-screen">
                <Text fontRole="heading" style={styles.sectionTitle}>Cancelar unidades · {cancellationEditor.item.productName}</Text>
                <Text style={styles.description}>Informe a quantidade confirmada, o motivo e se os insumos retornam ao estoque.</Text>
                <TextInput accessibilityLabel="Quantidade a cancelar" keyboardType="number-pad" onChangeText={(quantity) => setCancellationEditor((current) => current ? { ...current, quantity } : current)} placeholder="Quantidade" style={styles.input} value={cancellationEditor.quantity} />
                <TextInput accessibilityLabel="Motivo do cancelamento" onChangeText={(reason) => setCancellationEditor((current) => current ? { ...current, reason } : current)} placeholder="Motivo" style={styles.input} value={cancellationEditor.reason} />
                <View style={styles.actions}>
                  <ActionButton label="Devolver ao estoque" onPress={() => setCancellationEditor((current) => current ? { ...current, disposition: 'RETURN_TO_STOCK' } : current)} tone={cancellationEditor.disposition === 'RETURN_TO_STOCK' ? 'primary' : 'tertiary'} />
                  <ActionButton label="Registrar perda" onPress={() => setCancellationEditor((current) => current ? { ...current, disposition: 'LOSS' } : current)} tone={cancellationEditor.disposition === 'LOSS' ? 'primary' : 'tertiary'} />
                </View>
                <ActionButton disabled={isMutating} label="Confirmar cancelamento" onPress={() => {
                  const quantity = Number(cancellationEditor.quantity);
                  if (!Number.isInteger(quantity) || quantity <= 0 || !cancellationEditor.reason.trim()) {
                    setActionMessage('Informe quantidade e motivo válidos para cancelar.');
                    return;
                  }
                  void mutateComanda(
                    cancelComandaItemConfiguration(
                      normalizedApiBaseUrl,
                      comandaId,
                      cancellationEditor.item.id,
                      cancellationEditor.configuration.id,
                      {
                        disposition: cancellationEditor.disposition,
                        quantity,
                        reason: cancellationEditor.reason,
                        requestId: cancellationEditor.requestId,
                      },
                    ),
                    'Não foi possível cancelar as unidades. Tente novamente.',
                  );
                }} />
                <ActionButton label="Voltar" onPress={() => setCancellationEditor(undefined)} tone="tertiary" />
              </View>
            ) : null}
            {totalCancellationEditor ? (
              <View style={[styles.card, styles.cancellationEditorScreen]} testID="total-cancellation-screen">
                <Text fontRole="heading" style={styles.sectionTitle}>Cancelar comanda completa</Text>
                <Text style={styles.description}>
                  {totalCancellationEditor.hasConfirmedItems
                    ? 'Itens confirmados exigem a destinação dos insumos. Itens pendentes serão cancelados sem movimentar o estoque.'
                    : 'Informe o motivo. Os itens pendentes serão cancelados sem movimentar o estoque.'}
                </Text>
                <TextInput accessibilityLabel="Motivo do cancelamento total" onChangeText={(reason) => setTotalCancellationEditor((current) => current ? { ...current, reason } : current)} placeholder="Motivo" style={styles.input} value={totalCancellationEditor.reason} />
                {totalCancellationEditor.hasConfirmedItems ? (
                  <View style={styles.actions}>
                    <ActionButton label="Devolver ao estoque" onPress={() => setTotalCancellationEditor((current) => current ? { ...current, disposition: 'RETURN_TO_STOCK' } : current)} tone={totalCancellationEditor.disposition === 'RETURN_TO_STOCK' ? 'primary' : 'tertiary'} />
                    <ActionButton label="Registrar perda" onPress={() => setTotalCancellationEditor((current) => current ? { ...current, disposition: 'LOSS' } : current)} tone={totalCancellationEditor.disposition === 'LOSS' ? 'primary' : 'tertiary'} />
                  </View>
                ) : null}
                <ActionButton disabled={isMutating} label="Confirmar cancelamento total" onPress={() => {
                  if (totalCancellationEditor.reason.trim().length < 2) {
                    setActionMessage('Informe o motivo do cancelamento.');
                    return;
                  }
                  void confirmCancellation();
                }} />
                <ActionButton label="Voltar" onPress={() => setTotalCancellationEditor(undefined)} tone="tertiary" />
              </View>
            ) : null}
            {!cancellationEditor && !totalCancellationEditor ? (
              <>
            <ComandaItems
              pendingActions={counterPrintActions('pending')}
              confirmedActions={counterPrintActions('final')}
              comanda={state.comanda}
            disabled={isMutating || readOnly || state.comanda.status !== 'OPEN'}
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
            onCancelConfiguration={canCancelConfirmed && !readOnly && state.comanda.status === 'OPEN' ? (item, configuration) => {
              setActionMessage(undefined);
              setCancellationEditor({
                configuration,
                disposition: 'RETURN_TO_STOCK',
                item,
                quantity: '1',
                reason: '',
                requestId: `cancel-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              });
            } : undefined}
            onRemoveItem={(item) => {
              if (normalizedApiBaseUrl) {
                void mutateComanda(removeItemRequest(normalizedApiBaseUrl, comandaId, item.id));
              }
            }}
            onSetPendingQuantity={(item, pendingQuantity) => {
              if (!normalizedApiBaseUrl) {
                return;
              }
              void mutateComanda(
                setItemPendingQuantityRequest(
                  normalizedApiBaseUrl,
                  comandaId,
                  item.id,
                  pendingQuantity,
                ),
                'Não foi possível atualizar a quantidade. Tente novamente.',
              );
            }}
            />
            {normalizedApiBaseUrl && (state.comanda.tableName !== 'Balcão' || state.comanda.credit) ? (
              <ThermalPrintSection
                disabled={isMutating}
                onConflict={refresh}
                apiBaseUrl={normalizedApiBaseUrl}
                canPrint={canPrint}
                comandaId={comandaId}
              />
            ) : null}
            {!readOnly &&
              state.comanda.status === 'OPEN' &&
              !state.comanda.credit &&
              (!state.comanda.items.some((item) => item.confirmedQuantity > 0) ||
                canCancelConfirmed) && (
                <ComandaCancellationAction
                  disabled={isMutating}
                  hasItems={state.comanda.items.some((item) => item.quantity > 0)}
                  onCancel={() => {
                    if (state.comanda.items.some((item) => item.quantity > 0)) {
                      const hasConfirmedItems = state.comanda.items.some(
                        (item) => item.confirmedQuantity > 0,
                      );
                      setActionError(undefined);
                      setTotalCancellationEditor({
                        disposition: 'RETURN_TO_STOCK',
                        hasConfirmedItems,
                        reason: '',
                        requestId: `cancel-comanda-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                      });
                    } else {
                      void confirmCancellation();
                    }
                  }}
                />
              )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {state.kind === 'success' && !cancellationEditor && !totalCancellationEditor && (
        <SafeAreaView
          edges={['bottom']}
          onLayout={({ nativeEvent }) => {
            setFooterHeight(nativeEvent.layout.height);
          }}
          style={styles.fixedFooter}
          testID="comanda-footer"
        >
          <ComandaActions
            closeLabel={state.comanda.tableName === 'Balcão' ? 'Concluir venda' : undefined}
            canClose={(state.comanda.tableName !== 'Balcão' || (state.comanda.items.length > 0 && state.comanda.totalCents > 0)) && state.comanda.items.every(
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
        </SafeAreaView>
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
    <View style={styles.screenHeader} testID="comanda-details-header">
      <ScreenBackButton onPress={onBack} tone="light" />
      <View style={styles.headerCopy}>
        <View style={styles.contextRow}>
          <Text style={styles.eyebrow}>
            {comanda?.table ? `Mesa ${comanda.table.number}` : comanda?.tableName ?? 'Destiny Bistro CRM'}
          </Text>
          {comanda?.name && <Text style={styles.contextName}>· {comanda.name}</Text>}
        </View>
        <Text fontRole="heading" style={styles.title}>
          {comanda ? `Comanda #${comanda.number}` : 'Detalhes da comanda'}
        </Text>
        {comanda && (
          <Text style={styles.openedAt}>
            Aberta em {formatOperationalDateTime(comanda.openedAt)}
          </Text>
        )}
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
