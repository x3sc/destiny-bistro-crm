import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  addComandaItem,
  changeComandaItemQuantity,
  loadComanda,
  type Comanda,
  type ComandaItem,
  removeComandaItem,
} from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import {
  loadProducts,
  PRODUCT_CATEGORY_OPTIONS,
  type Product,
  type ProductCategory,
} from '../services/products-api';
import { themeColors } from '../theme/tokens';
import { styles } from './product-catalog-screen.styles';

interface ProductCatalogScreenProps {
  addItemRequest?: typeof addComandaItem;
  apiBaseUrl?: string;
  changeItemQuantityRequest?: typeof changeComandaItemQuantity;
  comandaId: string;
  loadComandaRequest?: typeof loadComanda;
  loadProductsRequest?: typeof loadProducts;
  onBack: () => void;
  removeItemRequest?: typeof removeComandaItem;
}

type ProductCatalogState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success'; products: Product[] };

export function ProductCatalogScreen({
  addItemRequest = addComandaItem,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  changeItemQuantityRequest = changeComandaItemQuantity,
  comandaId,
  loadComandaRequest = loadComanda,
  loadProductsRequest = loadProducts,
  onBack,
  removeItemRequest = removeComandaItem,
}: ProductCatalogScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [lastError, setLastError] = useState<string>();
  const [mutatingProductId, setMutatingProductId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>();
  const [state, setState] = useState<ProductCatalogState>({ kind: 'loading' });

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

  const changeProductQuantity = async (product: Product, delta: 1 | -1) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success') {
      return;
    }

    const item = state.comanda.items.find(
      (comandaItem) => comandaItem.productId === product.id,
    );
    const temporaryQuantity = item
      ? item.quantity - item.confirmedQuantity
      : 0;

    if (delta === -1 && (!item || temporaryQuantity === 0)) {
      return;
    }

    setMutatingProductId(product.id);
    setLastError(undefined);

    try {
      let comanda: Comanda;

      if (delta === 1 && !item) {
        comanda = await addItemRequest(normalizedApiBaseUrl, comandaId, product.id);
      } else if (
        delta === -1 &&
        item &&
        item.confirmedQuantity === 0 &&
        item.quantity === 1
      ) {
        comanda = await removeItemRequest(normalizedApiBaseUrl, comandaId, item.id);
      } else if (item) {
        comanda = await changeItemQuantityRequest(
          normalizedApiBaseUrl,
          comandaId,
          item.id,
          delta,
        );
      } else {
        return;
      }

      setState({ ...state, comanda });
    } catch {
      setLastError(
        delta === 1 && !item
          ? 'Não foi possível adicionar o produto.'
          : 'Não foi possível atualizar o produto.',
      );
    } finally {
      setMutatingProductId(undefined);
    }
  };

  const itemsByProduct = new Map(
    state.kind === 'success'
      ? state.comanda.items.map((item) => [item.productId, item])
      : [],
  );
  const availableCategories =
    state.kind === 'success'
      ? PRODUCT_CATEGORY_OPTIONS.filter(({ value }) =>
          state.products.some((product) => product.category === value),
        )
      : [];
  const normalizedSearchQuery = normalizeSearchText(searchQuery.trim());
  const visibleProducts =
    state.kind === 'success'
      ? state.products.filter(
          (product) =>
            (!selectedCategory || product.category === selectedCategory) &&
            (!normalizedSearchQuery ||
              normalizeSearchText(product.name).includes(normalizedSearchQuery)),
        )
      : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Pressable
            accessibilityLabel="Voltar para comanda"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>
              {state.kind === 'success'
                ? `${
                    state.comanda.table
                      ? `Mesa ${state.comanda.table.number}`
                      : 'Fiado manual'
                  } · Comanda #${state.comanda.number}`
                : 'Destiny Bistro CRM'}
            </Text>
            <Text style={styles.title}>Adicionar produtos</Text>
          </View>
        </View>

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
            <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
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
                  <Text style={styles.searchIcon}>⌕</Text>
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
                        active={selectedCategory === category.value}
                        key={category.value}
                        label={category.label}
                        onPress={() => {
                          setSelectedCategory(category.value);
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
                      onDecrement={() => {
                        void changeProductQuantity(item, -1);
                      }}
                      onIncrement={() => {
                        void changeProductQuantity(item, 1);
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
  product,
  submitting,
}: {
  disabled: boolean;
  item?: ComandaItem;
  onDecrement: () => void;
  onIncrement: () => void;
  product: Product;
  submitting: boolean;
}) {
  const temporaryQuantity = item
    ? item.quantity - item.confirmedQuantity
    : 0;

  return (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.description}>{formatCentsAsBrl(product.priceCents)}</Text>
        {item && (
          <Text style={styles.quantityText}>Já lançado: {item.quantity}</Text>
        )}
      </View>
      {temporaryQuantity > 0 ? (
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
            <Text
              accessibilityLabel={`${temporaryQuantity} unidades temporárias`}
              style={styles.quantityControlValue}
            >
              {temporaryQuantity}
            </Text>
          )}
          <QuantityButton
            accessibilityLabel={`Aumentar ${product.name}`}
            disabled={disabled}
            label="+"
            onPress={onIncrement}
          />
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
