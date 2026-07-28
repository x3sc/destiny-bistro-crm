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

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  addComandaItem,
  loadComanda,
  type Comanda,
} from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import {
  loadProducts,
  PRODUCT_CATEGORY_OPTIONS,
  type Product,
  type ProductCategory,
} from '../services/products-api';
import { styles } from './product-catalog-screen.styles';

interface ProductCatalogScreenProps {
  addItemRequest?: typeof addComandaItem;
  apiBaseUrl?: string;
  comandaId: string;
  loadComandaRequest?: typeof loadComanda;
  loadProductsRequest?: typeof loadProducts;
  onBack: () => void;
}

type ProductCatalogState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { comanda: Comanda; kind: 'success'; products: Product[] };

export function ProductCatalogScreen({
  addItemRequest = addComandaItem,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  comandaId,
  loadComandaRequest = loadComanda,
  loadProductsRequest = loadProducts,
  onBack,
}: ProductCatalogScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [lastError, setLastError] = useState<string>();
  const [mutatingProductId, setMutatingProductId] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>();
  const [state, setState] = useState<ProductCatalogState>({ kind: 'loading' });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl || !comandaId) {
      return;
    }

    setState({ kind: 'loading' });
    setLastError(undefined);
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

  const addProduct = async (product: Product) => {
    if (!normalizedApiBaseUrl || state.kind !== 'success') {
      return;
    }

    setMutatingProductId(product.id);
    setLastError(undefined);

    try {
      const comanda = await addItemRequest(normalizedApiBaseUrl, comandaId, product.id);
      setState({ ...state, comanda });
    } catch {
      setLastError('Não foi possível adicionar o produto.');
    } finally {
      setMutatingProductId(undefined);
    }
  };

  const quantitiesByProduct = new Map(
    state.kind === 'success'
      ? state.comanda.items.map((item) => [item.productId, item.quantity])
      : [],
  );
  const availableCategories =
    state.kind === 'success'
      ? PRODUCT_CATEGORY_OPTIONS.filter(({ value }) =>
          state.products.some((product) => product.category === value),
        )
      : [];
  const visibleProducts =
    state.kind === 'success' && selectedCategory
      ? state.products.filter((product) => product.category === selectedCategory)
      : [];
  const selectedCategoryLabel = PRODUCT_CATEGORY_OPTIONS.find(
    ({ value }) => value === selectedCategory,
  )?.label;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>Adicionar produtos</Text>
          <Text style={styles.description}>Permaneça nesta tela para lançar vários itens.</Text>
        </View>

        {!normalizedApiBaseUrl && (
          <Message text="Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo." />
        )}
        {!comandaId && <Message text="Comanda inválida." />}

        {normalizedApiBaseUrl && comandaId && state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color="#6f4e37" size="large" />
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
            {availableCategories.length > 0 && !selectedCategory && (
              <FlatList
                columnWrapperStyle={styles.categoryRow}
                contentContainerStyle={styles.categoryGrid}
                data={availableCategories}
                key="category-grid"
                keyExtractor={(category) => category.value}
                numColumns={2}
                renderItem={({ item }) => (
                  <CategoryCard
                    count={
                      state.products.filter((product) => product.category === item.value)
                        .length
                    }
                    label={item.label}
                    onPress={() => {
                      setSelectedCategory(item.value);
                    }}
                  />
                )}
              />
            )}
            {selectedCategory && (
              <>
                <View style={styles.selectedCategoryHeader}>
                  <Text style={styles.selectedCategoryTitle}>
                    {selectedCategoryLabel}
                  </Text>
                  <ActionButton
                    label="Voltar às categorias"
                    onPress={() => {
                      setSelectedCategory(undefined);
                    }}
                    tone="secondary"
                  />
                </View>
                <FlatList
                  contentContainerStyle={styles.productList}
                  data={visibleProducts}
                  key="product-list"
                  keyExtractor={(product) => product.id}
                  renderItem={({ item }) => (
                    <ProductCard
                      disabled={!!mutatingProductId}
                      onAdd={() => {
                        void addProduct(item);
                      }}
                      product={item}
                      quantity={quantitiesByProduct.get(item.id) ?? 0}
                      submitting={mutatingProductId === item.id}
                    />
                  )}
                />
              </>
            )}
            <ActionButton label="Voltar para comanda" onPress={onBack} tone="secondary" />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function CategoryCard({
  count,
  label,
  onPress,
}: {
  count: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryCard,
        pressed && styles.pressedCategoryCard,
      ]}
    >
      <Text style={styles.categoryCardText}>{label}</Text>
      <Text style={styles.categoryCount}>
        {count} {count === 1 ? 'opção' : 'opções'}
      </Text>
    </Pressable>
  );
}

function ProductCard({
  disabled,
  onAdd,
  product,
  quantity,
  submitting,
}: {
  disabled: boolean;
  onAdd: () => void;
  product: Product;
  quantity: number;
  submitting: boolean;
}) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.description}>{formatCentsAsBrl(product.priceCents)}</Text>
        {quantity > 0 && (
          <Text style={styles.quantityText}>Já lançado: {quantity}</Text>
        )}
      </View>
      <ActionButton
        disabled={disabled}
        label={submitting ? 'Adicionando...' : 'Adicionar'}
        onPress={onAdd}
      />
    </View>
  );
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
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
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
