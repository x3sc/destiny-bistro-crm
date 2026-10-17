import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  addComandaItem,
  changeComandaItemQuantity,
  discardPendingComandaItems,
  loadComanda,
  type Comanda,
  type ComandaItem,
  removeComandaItem,
  setComandaItemPendingQuantity,
} from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import {
  loadProducts,
  type Product,
} from '../services/products-api';
import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';
import { BrandedScreenHeader } from './branded-screen-header';
import { styles } from './product-catalog-screen.styles';
import { comandaNavigationResource, useNavigationGuard, useSafeNavigationCompletion } from '../navigation/safe-navigation';

interface ProductCatalogScreenProps {
  canOperate?: (comanda: Comanda) => boolean;
  addItemRequest?: typeof addComandaItem;
  apiBaseUrl?: string;
  changeItemQuantityRequest?: typeof changeComandaItemQuantity;
  comandaId: string;
  discardPendingItemsRequest?: typeof discardPendingComandaItems;
  loadComandaRequest?: typeof loadComanda;
  loadProductsRequest?: typeof loadProducts;
  onBack: () => void;
  onAdded?: (comanda: Comanda) => void;
  removeItemRequest?: typeof removeComandaItem;
  setItemPendingQuantityRequest?: typeof setComandaItemPendingQuantity;
}

type ProductCatalogState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success'; products: Product[] };

interface PendingQuantityDraft {
  pendingQuantity: number;
  productId: string;
}

export function ProductCatalogScreen({
  addItemRequest = addComandaItem,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  changeItemQuantityRequest = changeComandaItemQuantity,
  comandaId,
  discardPendingItemsRequest = discardPendingComandaItems,
  loadComandaRequest = loadComanda,
  loadProductsRequest = loadProducts,
  onBack,
  canOperate = () => true,
  onAdded,
  removeItemRequest = removeComandaItem,
  setItemPendingQuantityRequest = setComandaItemPendingQuantity,
}: ProductCatalogScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const completeNavigation = useSafeNavigationCompletion();
  const [lastError, setLastError] = useState<string>();
  const [isCancelling, setIsCancelling] = useState(false);
  const [mutatingProductId, setMutatingProductId] = useState<string>();
  const [pendingQuantityDrafts, setPendingQuantityDrafts] = useState<
    Record<string, number>
  >({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [state, setState] = useState<ProductCatalogState>({ kind: 'loading' });
  const pendingQuantityDraftsRef = useRef(
    new Map<string, PendingQuantityDraft>(),
  );
  const quantityFlushPromiseRef = useRef<Promise<Comanda | undefined> | undefined>(
    undefined,
  );

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      return;
    }

    setState({ kind: 'loading' });
    setLastError(undefined);
    setSearchQuery('');
    setSelectedCategory(undefined);
    void Promise.all([
      loadProductsRequest(normalizedApiBaseUrl),
      loadComandaRequest(normalizedApiBaseUrl, comandaId),
    ]).then(
      ([products, comanda]) => {
        setState({ comanda, kind: 'success', products });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [comandaId, loadComandaRequest, loadProductsRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const displayedComanda =
    state.kind === 'success'
      ? (() => {
          const existingProductIds = new Set(
            state.comanda.items.map((item) => item.productId),
          );
          const existingItems = state.comanda.items.map((item) => {
            const pendingQuantity = pendingQuantityDrafts[item.productId];
            return pendingQuantity === undefined
              ? item
              : {
                  ...item,
                  quantity: item.confirmedQuantity + pendingQuantity,
                };
          });
          const localItems = Object.entries(pendingQuantityDrafts).flatMap(
            ([productId, pendingQuantity]) => {
            if (
              existingProductIds.has(productId) ||
              pendingQuantity === 0
            ) {
              return [];
            }
            const product = state.products.find(
              (candidate) => candidate.id === productId,
            );
            return product
              ? [
                  {
                    confirmedQuantity: 0,
                    createdAt: state.comanda.openedAt,
                    id: `draft:${product.id}`,
                    productId: product.id,
                    productName: product.name,
                    quantity: pendingQuantity,
                    subtotalCents: product.priceCents * pendingQuantity,
                    unitPriceCents: product.priceCents,
                  },
                ]
              : [];
            },
          );
          return {
            ...state.comanda,
            items: [...existingItems, ...localItems],
          };
        })()
      : undefined;

  const flushPendingQuantityDrafts = async (): Promise<Comanda | undefined> => {
    if (quantityFlushPromiseRef.current) {
      return quantityFlushPromiseRef.current;
    }
    if (!normalizedApiBaseUrl || state.kind !== 'success') {
      return undefined;
    }

    const drafts = Array.from(pendingQuantityDraftsRef.current.values());
    if (drafts.length === 0) {
      return state.comanda;
    }

    const flushPromise = (async () => {
      setMutatingProductId('__pending_quantities__');
      setLastError(undefined);
      try {
        let comanda = state.comanda;
        for (const draft of drafts) {
          const currentItem = comanda.items.find(
            (item) => item.productId === draft.productId,
          );
          if (!currentItem) {
            if (draft.pendingQuantity === 0) {
              continue;
            }
            comanda = await addItemRequest(
              normalizedApiBaseUrl,
              comandaId,
              draft.productId,
            );
            const addedItem = comanda.items.find(
              (item) => item.productId === draft.productId,
            );
            if (draft.pendingQuantity > 1 && addedItem) {
              comanda = await setItemPendingQuantityRequest(
                normalizedApiBaseUrl,
                comandaId,
                addedItem.id,
                draft.pendingQuantity,
              );
            }
            continue;
          }
          if (draft.pendingQuantity === 0) {
            if (currentItem.confirmedQuantity === 0) {
              comanda = await removeItemRequest(
                normalizedApiBaseUrl,
                comandaId,
                currentItem.id,
              );
            } else {
              const currentPendingQuantity =
                currentItem.quantity - currentItem.confirmedQuantity;
              if (currentPendingQuantity > 1) {
                comanda = await setItemPendingQuantityRequest(
                  normalizedApiBaseUrl,
                  comandaId,
                  currentItem.id,
                  1,
                );
              }
              comanda = await changeItemQuantityRequest(
                normalizedApiBaseUrl,
                comandaId,
                currentItem.id,
                -1,
              );
            }
          } else {
            comanda = await setItemPendingQuantityRequest(
              normalizedApiBaseUrl,
              comandaId,
              currentItem.id,
              draft.pendingQuantity,
            );
          }
        }
        pendingQuantityDraftsRef.current.clear();
        setPendingQuantityDrafts({});
        setState({ ...state, comanda });
        return comanda;
      } catch {
        pendingQuantityDraftsRef.current.clear();
        setPendingQuantityDrafts({});
        setLastError(
          'Não foi possível concluir as alterações. Recarregue a comanda e tente novamente.',
        );
        return undefined;
      } finally {
        setMutatingProductId(undefined);
      }
    })();
    quantityFlushPromiseRef.current = flushPromise;
    try {
      return await flushPromise;
    } finally {
      if (quantityFlushPromiseRef.current === flushPromise) {
        quantityFlushPromiseRef.current = undefined;
      }
    }
  };

  const stagePendingQuantity = (
    product: Product,
    item: ComandaItem | undefined,
    pendingQuantity: number,
  ) => {
    const maximumPendingQuantity = 99 - (item?.confirmedQuantity ?? 0);
    if (
      !Number.isInteger(pendingQuantity) ||
      pendingQuantity < 0 ||
      pendingQuantity > maximumPendingQuantity
    ) {
      return Promise.resolve(false);
    }

    const persistedItem =
      state.kind === 'success'
        ? state.comanda.items.find(
            (candidate) => candidate.productId === product.id,
          )
        : undefined;
    if (!persistedItem && pendingQuantity === 0) {
      pendingQuantityDraftsRef.current.delete(product.id);
      setPendingQuantityDrafts((current) => {
        const updated = { ...current };
        delete updated[product.id];
        return updated;
      });
      return Promise.resolve(true);
    }

    const draft = {
      pendingQuantity,
      productId: product.id,
    };
    pendingQuantityDraftsRef.current.set(product.id, draft);
    setPendingQuantityDrafts((current) => ({
      ...current,
      [product.id]: pendingQuantity,
    }));
    setLastError(undefined);
    return Promise.resolve(true);
  };

  const changeProductQuantity = async (product: Product, delta: 1 | -1) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success') {
      return;
    }

    const item = displayedComanda?.items.find(
      (comandaItem) => comandaItem.productId === product.id,
    );
    const temporaryQuantity = item
      ? item.quantity - item.confirmedQuantity
      : 0;

    if (delta === -1 && (!item || temporaryQuantity === 0)) {
      return;
    }

    if (item) {
      await stagePendingQuantity(product, item, temporaryQuantity + delta);
      return;
    }
    await stagePendingQuantity(product, undefined, 1);
  };

  const itemsByProduct = new Map(
    displayedComanda?.items.map((item) => [item.productId, item]) ?? [],
  );
  const availableCategories =
    state.kind === 'success'
      ? Array.from(
          new Map(
            state.products.map((product) => [
              product.category.id,
              product.category,
            ]),
          ).values(),
        ).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      : [];
  const normalizedSearchQuery = normalizeSearchText(searchQuery.trim());
  const visibleProducts =
    state.kind === 'success'
      ? state.products.filter(
          (product) =>
            (!selectedCategory || product.category.id === selectedCategory) &&
            (!normalizedSearchQuery ||
              normalizeSearchText(product.name).includes(normalizedSearchQuery)),
        )
      : [];
  const pendingItemCount =
    displayedComanda
      ? displayedComanda.items.reduce(
          (total, item) =>
            total + Math.max(item.quantity - item.confirmedQuantity, 0),
          0,
        )
      : 0;
  const hasPendingQuantityDrafts =
    Object.keys(pendingQuantityDrafts).length > 0;
  useNavigationGuard({
    busy: Boolean(mutatingProductId) || isCancelling,
    dirty: hasPendingQuantityDrafts,
    resource: state.kind === 'success' ? comandaNavigationResource(state.comanda) : undefined,
    discard: () => { pendingQuantityDraftsRef.current.clear(); setPendingQuantityDrafts({}); },
  });

  const cancelPendingItems = async () => {
    if (
      !normalizedApiBaseUrl ||
      state.kind !== 'success' ||
      isCancelling
    ) {
      return;
    }
    pendingQuantityDraftsRef.current.clear();
    setPendingQuantityDrafts({});
    setIsCancelling(true);
    setLastError(undefined);
    try {
      if (quantityFlushPromiseRef.current) {
        await quantityFlushPromiseRef.current;
      }
      const comanda = await discardPendingItemsRequest(
        normalizedApiBaseUrl,
        comandaId,
      );
      setState({ ...state, comanda });
      completeNavigation(() => onAdded?.(comanda));
    } catch {
      setLastError(
        'Não foi possível cancelar os itens. Nada foi alterado; tente novamente.',
      );
    } finally {
      setIsCancelling(false);
    }
  };

  if (state.kind === 'success' && !canOperate(state.comanda)) return <SafeAreaView style={styles.safeArea}>
    <BrandedScreenHeader title="Adicionar produtos" onBack={onBack} /><Message text="Sem permissão para operar esta comanda." />
  </SafeAreaView>;
  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description={
          state.kind === 'success'
            ? `${
                state.comanda.table
                  ? `Mesa ${state.comanda.table.number}`
                  : state.comanda.tableName ?? 'Fiado manual'
              } · Comanda #${state.comanda.number}`
            : undefined
        }
        onBack={onBack}
        title="Adicionar produtos"
      />
      <View style={styles.content}>
        {!normalizedApiBaseUrl && (
          <Message text="Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo." />
        )}
        {!comandaId && <Message text="Comanda inválida." />}

        {normalizedApiBaseUrl && comandaId && state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.description}>Carregando catálogo...</Text>
          </View>
        )}

        {normalizedApiBaseUrl && comandaId && state.kind === 'error' && (
          <View style={styles.actions}>
            <Message text="Não foi possível carregar o catálogo." />
            <ActionButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}

        {state.kind === 'success' && (
          <>
            {lastError && <Message text={lastError} />}
            {state.products.length === 0 && (
              <Text style={styles.messageCard}>Nenhum produto ativo disponível.</Text>
            )}
            {state.products.length > 0 && (
              <>
                <View style={styles.searchField}>
                  <AppIcon color={themeColors.icon} name="search" size={18} />
                  <TextInput
                    accessibilityLabel="Buscar produto"
                    accessibilityRole="search"
                    onChangeText={setSearchQuery}
                    placeholder="Buscar produto..."
                    placeholderTextColor={themeColors.placeholder}
                    style={styles.searchInput}
                    value={searchQuery}
                  />
                </View>
                <View style={styles.categoryBar}>
                  <ScrollView
                    contentContainerStyle={styles.categoryChips}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryScroll}
                  >
                    <CategoryChip
                      active={!selectedCategory}
                      label="Todos"
                      onPress={() => {
                        setSelectedCategory(undefined);
                      }}
                    />
                    {availableCategories.map((category) => (
                      <CategoryChip
                        active={selectedCategory === category.id}
                        key={category.id}
                        label={category.name}
                        onPress={() => {
                          setSelectedCategory(category.id);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
                <FlatList
                  contentContainerStyle={styles.productList}
                  data={visibleProducts}
                  keyExtractor={(product) => product.id}
                  ListEmptyComponent={
                    <Text style={styles.emptyResults}>
                      Nenhum produto encontrado para “{searchQuery}”.
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <ProductCard
                      disabled={!!mutatingProductId}
                      item={itemsByProduct.get(item.id)}
                      key={`${item.id}-${itemsByProduct.get(item.id)?.quantity ?? 0}`}
                      onDecrement={() => {
                        void changeProductQuantity(item, -1);
                      }}
                      onIncrement={() => {
                        void changeProductQuantity(item, 1);
                      }}
                      onSetTemporaryQuantity={(pendingQuantity) => {
                        const comandaItem = itemsByProduct.get(item.id);
                        return stagePendingQuantity(
                          item,
                          comandaItem,
                          pendingQuantity,
                        );
                      }}
                      product={item}
                      submitting={mutatingProductId === item.id}
                    />
                  )}
                  style={styles.productListContainer}
                />
              </>
            )}
          </>
        )}
      </View>
      {state.kind === 'success' && (
        <View style={styles.pendingBar}>
          <View style={styles.pendingSummary}>
            <Text fontRole="heading" style={styles.pendingCount}>
              {pendingItemCount}{' '}
              {pendingItemCount === 1 ? 'item pendente' : 'itens pendentes'}
            </Text>
            <Text style={styles.pendingHint}>
              Ao adicionar, você volta para a comanda.
            </Text>
          </View>
          <ActionButton
            accessibilityLabel={`Adicionar ${pendingItemCount} ${pendingItemCount === 1 ? 'item' : 'itens'}`}
            disabled={
              (pendingItemCount === 0 && !hasPendingQuantityDrafts) ||
              isCancelling ||
              !!mutatingProductId
            }
            label={
              mutatingProductId
                ? 'Adicionando...'
                : `Adicionar ${pendingItemCount} ${pendingItemCount === 1 ? 'item' : 'itens'}`
            }
            onPress={() => {
              void flushPendingQuantityDrafts().then((comanda) => {
                if (comanda) {
                  completeNavigation(() => onAdded?.(comanda));
                }
              });
            }}
          />
          <ActionButton
            accessibilityLabel="Cancelar"
            disabled={isCancelling || !!mutatingProductId}
            label={isCancelling ? 'Cancelando...' : 'Cancelar'}
            onPress={() => {
              void cancelPendingItems();
            }}
            tone="secondary"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function CategoryChip({
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
        styles.categoryChip,
        active && styles.activeCategoryChip,
        pressed && styles.pressedButton,
      ]}
    >
      <Text
        style={[
          styles.categoryChipText,
          active && styles.activeCategoryChipText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function ProductCard({
  disabled,
  item,
  onDecrement,
  onIncrement,
  onSetTemporaryQuantity,
  product,
  submitting,
}: {
  disabled: boolean;
  item?: ComandaItem;
  onDecrement: () => void;
  onIncrement: () => void;
  onSetTemporaryQuantity: (pendingQuantity: number) => Promise<boolean>;
  product: Product;
  submitting: boolean;
}) {
  const temporaryQuantity = item
    ? item.quantity - item.confirmedQuantity
    : 0;
  const [quantityText, setQuantityText] = useState(String(temporaryQuantity));
  const lastSubmittedQuantity = useRef<number | undefined>(undefined);

  const submitTemporaryQuantity = async () => {
    const quantity = Number(quantityText);
    const maximumPendingQuantity = 99 - (item?.confirmedQuantity ?? 0);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > maximumPendingQuantity
    ) {
      setQuantityText(String(temporaryQuantity));
      return;
    }
    if (
      quantity === temporaryQuantity ||
      quantity === lastSubmittedQuantity.current
    ) {
      return;
    }
    lastSubmittedQuantity.current = quantity;
    const updated = await onSetTemporaryQuantity(quantity);
    if (!updated) {
      lastSubmittedQuantity.current = undefined;
      setQuantityText(String(temporaryQuantity));
    }
  };

  return (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text fontRole="heading" style={styles.productName}>{product.name}</Text>
        <Text style={styles.description}>{formatCentsAsBrl(product.priceCents)}</Text>
        {item && (
          <Text style={styles.quantityText}>Já lançado: {item.quantity}</Text>
        )}
      </View>
      {temporaryQuantity > 0 ? (
        <View style={styles.productActions}>
          <Text style={styles.temporaryQuantityLabel}>
            {temporaryQuantity}{' '}
            {temporaryQuantity === 1
              ? 'unidade temporária'
              : 'unidades temporárias'}
          </Text>
          <View style={[styles.quantityControl, disabled && styles.disabledButton]}>
            <QuantityButton
              accessibilityLabel={`Diminuir ${product.name}`}
              disabled={disabled}
              label="−"
              onPress={onDecrement}
            />
            {submitting ? (
              <ActivityIndicator color={themeColors.primary} size="small" />
            ) : (
              <TextInput
                accessibilityLabel={`Quantidade temporária de ${product.name}`}
                editable={!disabled}
                keyboardType="number-pad"
                maxLength={2}
                onBlur={() => {
                  void submitTemporaryQuantity();
                }}
                onChangeText={(value) => {
                  lastSubmittedQuantity.current = undefined;
                  setQuantityText(value.replace(/[^0-9]/g, ''));
                }}
                onSubmitEditing={() => {
                  void submitTemporaryQuantity();
                }}
                selectTextOnFocus
                style={styles.quantityControlInput}
                value={quantityText}
              />
            )}
            <QuantityButton
              accessibilityLabel={`Aumentar ${product.name}`}
              disabled={disabled}
              label="+"
              onPress={onIncrement}
            />
          </View>
        </View>
      ) : (
        <ActionButton
          accessibilityLabel={`Adicionar ${product.name}`}
          disabled={disabled}
          label={submitting ? 'Adicionando...' : '＋  Adicionar'}
          onPress={onIncrement}
        />
      )}
    </View>
  );
}

function QuantityButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quantityControlButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={styles.quantityControlButtonText}>{label}</Text>
    </Pressable>
  );
}

function Message({ text }: { text: string }) {
  return <Text style={styles.error}>{text}</Text>;
}

function ActionButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
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
