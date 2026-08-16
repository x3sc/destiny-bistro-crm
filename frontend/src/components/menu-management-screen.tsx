import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createMenuCategory,
  createMenuProduct,
  deleteMenuCategory,
  deleteMenuProduct,
  loadAdminMenu,
  type MenuCategory,
  type MenuProduct,
  updateMenuCategory,
  updateMenuProduct,
} from '../services/menu-admin-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { ScreenBackButton } from './screen-back-button';

type CategoryEditor =
  | { kind: 'create'; name: string }
  | { category: MenuCategory; kind: 'edit'; name: string };
type ProductEditor =
  | { category: MenuCategory; description: string; kind: 'create'; name: string; price: string }
  | { category: MenuCategory; description: string; kind: 'edit'; name: string; price: string; product: MenuProduct };

type ScreenState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { categories: MenuCategory[]; kind: 'success' };

export function MenuManagementScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  createCategoryRequest = createMenuCategory,
  createProductRequest = createMenuProduct,
  deleteCategoryRequest = deleteMenuCategory,
  deleteProductRequest = deleteMenuProduct,
  loadRequest = loadAdminMenu,
  onBack,
  onRecipes,
  updateCategoryRequest = updateMenuCategory,
  updateProductRequest = updateMenuProduct,
}: {
  apiBaseUrl?: string;
  createCategoryRequest?: typeof createMenuCategory;
  createProductRequest?: typeof createMenuProduct;
  deleteCategoryRequest?: typeof deleteMenuCategory;
  deleteProductRequest?: typeof deleteMenuProduct;
  loadRequest?: typeof loadAdminMenu;
  onBack: () => void;
  onRecipes?: () => void;
  updateCategoryRequest?: typeof updateMenuCategory;
  updateProductRequest?: typeof updateMenuProduct;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>();
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditor>();
  const [productEditor, setProductEditor] = useState<ProductEditor>();
  const [message, setMessage] = useState<string>();
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(() => {
    const request = normalizedApiBaseUrl
      ? loadRequest(normalizedApiBaseUrl)
      : Promise.reject(new Error('API não configurada'));

    return request.then(
      (categories) => setState({ categories, kind: 'success' }),
      () => setState({ kind: 'error' }),
    );
  }, [loadRequest, normalizedApiBaseUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = async <Result,>(
    request: () => Promise<Result>,
    success: string,
    onSuccess?: (result: Result) => void,
  ) => {
    if (mutating) {
      return;
    }
    setMutating(true);
    setMessage(undefined);
    try {
      const result = await request();
      await refresh();
      setCategoryEditor(undefined);
      setProductEditor(undefined);
      onSuccess?.(result);
      setMessage(success);
    } catch {
      setMessage('Não foi possível concluir a alteração. Confira os dados e tente novamente.');
    } finally {
      setMutating(false);
    }
  };

  const saveCategory = () => {
    if (!normalizedApiBaseUrl || !categoryEditor || categoryEditor.name.trim().length < 2) {
      setMessage('Informe um nome de categoria com pelo menos 2 caracteres.');
      return;
    }
    const request = categoryEditor.kind === 'create'
      ? () => createCategoryRequest(normalizedApiBaseUrl, { name: categoryEditor.name })
      : () => updateCategoryRequest(normalizedApiBaseUrl, categoryEditor.category.id, {
          active: categoryEditor.category.active,
          name: categoryEditor.name,
        });
    void mutate(
      request,
      'Categoria salva.',
      categoryEditor.kind === 'create'
        ? (category) => setExpandedCategoryId(category.id)
        : undefined,
    );
  };

  const saveProduct = () => {
    if (!normalizedApiBaseUrl || !productEditor) {
      return;
    }
    const priceCents = parseBrlCents(productEditor.price);
    if (productEditor.name.trim().length < 2 || priceCents === null || priceCents <= 0) {
      setMessage('Informe o nome e um preço válido maior que zero.');
      return;
    }
    const input = {
      categoryId: productEditor.category.id,
      description: productEditor.description.trim() || null,
      name: productEditor.name,
      priceCents,
    };
    const request = productEditor.kind === 'create'
      ? () => createProductRequest(normalizedApiBaseUrl, input)
      : () => updateProductRequest(normalizedApiBaseUrl, productEditor.product.id, {
          ...input,
          active: productEditor.product.active,
        });
    void mutate(request, 'Item salvo.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenBackButton onPress={onBack} />
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>Administrativo</Text>
            <Text style={styles.title}>Cardápio</Text>
            <Text style={styles.description}>
              Organize categorias e os itens e valores disponíveis em cada uma.
            </Text>
          </View>
        </View>

        {message && <Text style={styles.message}>{message}</Text>}

        <ActionButton
          disabled={mutating}
          label="Nova categoria"
          onPress={() => {
            setProductEditor(undefined);
            setCategoryEditor({ kind: 'create', name: '' });
            setMessage(undefined);
          }}
        />
        {onRecipes ? (
          <ActionButton label="Receitas e adicionais" onPress={onRecipes} tone="secondary" />
        ) : null}

        {categoryEditor?.kind === 'create' && (
          <CategoryEditorForm
            disabled={mutating}
            editor={categoryEditor}
            onCancel={() => setCategoryEditor(undefined)}
            onChange={setCategoryEditor}
            onSave={saveCategory}
          />
        )}

        {state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primary} size="large" />
            <Text style={styles.description}>Carregando cardápio...</Text>
          </View>
        )}
        {state.kind === 'error' && (
          <View style={styles.editor}>
            <Text style={styles.message}>Não foi possível carregar o cardápio.</Text>
            <ActionButton label="Tentar novamente" onPress={() => void refresh()} />
          </View>
        )}
        {state.kind === 'success' && state.categories.length === 0 && (
          <Text style={styles.empty}>Nenhuma categoria cadastrada.</Text>
        )}
        {state.kind === 'success' && state.categories.map((category) => (
          <CategoryCard
            category={category}
            categoryEditor={
              categoryEditor?.kind === 'edit'
                && categoryEditor.category.id === category.id
                ? categoryEditor
                : undefined
            }
            disabled={mutating}
            expanded={expandedCategoryId === category.id}
            key={category.id}
            onCreateProduct={() => {
              setCategoryEditor(undefined);
              setProductEditor({
                category,
                description: '',
                kind: 'create',
                name: '',
                price: centsInput(0),
              });
              setMessage(undefined);
            }}
            onDeactivate={() => {
              if (normalizedApiBaseUrl) {
                void mutate(
                  () => deleteCategoryRequest(normalizedApiBaseUrl, category.id),
                  'Categoria e seus itens foram desativados.',
                );
              }
            }}
            onCategoryEditorChange={setCategoryEditor}
            onEdit={() => {
              setProductEditor(undefined);
              setCategoryEditor({ category, kind: 'edit', name: category.name });
            }}
            onEditProduct={(product) => {
              setCategoryEditor(undefined);
              setProductEditor({
                category,
                description: product.description ?? '',
                kind: 'edit',
                name: product.name,
                price: centsInput(product.priceCents),
                product,
              });
            }}
            onProductEditorChange={setProductEditor}
            onProductActiveChange={(product, active) => {
              if (!normalizedApiBaseUrl) {
                return;
              }
              const request = active
                ? () => updateProductRequest(normalizedApiBaseUrl, product.id, {
                    active: true,
                    categoryId: category.id,
                    description: product.description,
                    name: product.name,
                    priceCents: product.priceCents,
                  })
                : () => deleteProductRequest(normalizedApiBaseUrl, product.id);
              void mutate(request, active ? 'Item ativado.' : 'Item desativado.');
            }}
            onReactivate={() => {
              if (normalizedApiBaseUrl) {
                void mutate(
                  () => updateCategoryRequest(normalizedApiBaseUrl, category.id, {
                    active: true,
                    name: category.name,
                  }),
                  'Categoria ativada.',
                );
              }
            }}
            onSaveProduct={saveProduct}
            onSaveCategory={saveCategory}
            onToggle={() => {
              setExpandedCategoryId((current) =>
                current === category.id ? undefined : category.id,
              );
              setCategoryEditor(undefined);
              setProductEditor(undefined);
            }}
            productEditor={
              productEditor?.category.id === category.id
                ? productEditor
                : undefined
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryCard({
  category,
  categoryEditor,
  disabled,
  expanded,
  onCreateProduct,
  onDeactivate,
  onCategoryEditorChange,
  onEdit,
  onEditProduct,
  onProductEditorChange,
  onProductActiveChange,
  onReactivate,
  onSaveProduct,
  onSaveCategory,
  onToggle,
  productEditor,
}: {
  category: MenuCategory;
  categoryEditor?: Extract<CategoryEditor, { kind: 'edit' }>;
  disabled: boolean;
  expanded: boolean;
  onCreateProduct: () => void;
  onDeactivate: () => void;
  onCategoryEditorChange: (editor: CategoryEditor | undefined) => void;
  onEdit: () => void;
  onEditProduct: (product: MenuProduct) => void;
  onProductEditorChange: (editor: ProductEditor | undefined) => void;
  onProductActiveChange: (product: MenuProduct, active: boolean) => void;
  onReactivate: () => void;
  onSaveProduct: () => void;
  onSaveCategory: () => void;
  onToggle: () => void;
  productEditor?: ProductEditor;
}) {
  return (
    <View
      style={[styles.categoryCard, !category.active && styles.inactive]}
      testID={`menu-category-${category.id}`}
    >
      <Pressable
        accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} categoria ${category.name}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.categoryHeader,
          pressed && styles.categoryHeaderPressed,
        ]}
      >
        <View style={styles.headingCopy}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.meta}>
            {category.products.length} {category.products.length === 1 ? 'item' : 'itens'} · {category.active ? 'Ativa' : 'Inativa'}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.categoryBody}>
          <ActionButton
            disabled={disabled}
            label={`Editar categoria ${category.name}`}
            onPress={onEdit}
            tone="secondary"
          />

          {categoryEditor && (
            <CategoryEditorForm
              disabled={disabled}
              editor={categoryEditor}
              onCancel={() => onCategoryEditorChange(undefined)}
              onChange={onCategoryEditorChange}
              onSave={onSaveCategory}
            />
          )}

          {productEditor && (
            <ProductEditorForm
              disabled={disabled}
              editor={productEditor}
              onCancel={() => onProductEditorChange(undefined)}
              onChange={onProductEditorChange}
              onSave={onSaveProduct}
            />
          )}

          {category.products.map((product) => (
            <View
              key={product.id}
              style={[styles.productRow, !product.active && styles.inactive]}
            >
              <View style={styles.headingCopy}>
                <Text style={styles.productName}>{product.name}</Text>
                {product.description && (
                  <Text style={styles.meta}>{product.description}</Text>
                )}
                <Text style={styles.price}>
                  {formatCentsAsBrl(product.priceCents)}
                </Text>
                {product.recipe?.length ? (
                  <Text style={styles.meta}>
                    Ficha técnica · {product.recipe.length} {product.recipe.length === 1 ? 'insumo' : 'insumos'}
                  </Text>
                ) : (
                  <Text style={styles.warning}>Sem ficha técnica</Text>
                )}
                {(product.additionals?.length ?? 0) > 0 ? (
                  <Text style={styles.meta}>
                    Adicionais: {product.additionals?.map(({ name }) => name).join(', ')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.productActions}>
                <Pressable
                  accessibilityLabel={`Editar item ${product.name}`}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => onEditProduct(product)}
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>Editar</Text>
                </Pressable>
                <Switch
                  accessibilityLabel={`${product.active ? 'Desativar' : 'Ativar'} item ${product.name}`}
                  disabled={disabled || !category.active}
                  onValueChange={(active) =>
                    onProductActiveChange(product, active)
                  }
                  trackColor={{
                    false: themeColors.border,
                    true: themeColors.primary,
                  }}
                  value={product.active}
                />
              </View>
            </View>
          ))}

          {category.products.length === 0 && (
            <Text style={styles.empty}>Nenhum item nesta categoria.</Text>
          )}
          <View style={styles.cardActions}>
            {category.active && (
              <>
                <ActionButton
                  disabled={disabled}
                  label={`Novo item em ${category.name}`}
                  onPress={onCreateProduct}
                  tone="secondary"
                />
                <ActionButton
                  disabled={disabled}
                  label={`Desativar categoria ${category.name}`}
                  onPress={onDeactivate}
                  tone="danger"
                />
              </>
            )}
            {!category.active && (
              <ActionButton
                disabled={disabled}
                label={`Ativar categoria ${category.name}`}
                onPress={onReactivate}
                tone="secondary"
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function CategoryEditorForm({
  disabled,
  editor,
  onCancel,
  onChange,
  onSave,
}: {
  disabled: boolean;
  editor: CategoryEditor;
  onCancel: () => void;
  onChange: (editor: CategoryEditor) => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>
        {editor.kind === 'create' ? 'Nova categoria' : 'Editar categoria'}
      </Text>
      <Field
        accessibilityLabel="Nome da categoria"
        label="Nome"
        onChangeText={(name) => onChange({ ...editor, name })}
        placeholder="Ex.: Sobremesas"
        value={editor.name}
      />
      <View style={styles.editorActions}>
        <ActionButton disabled={disabled} label="Salvar categoria" onPress={onSave} />
        <ActionButton label="Cancelar" onPress={onCancel} tone="secondary" />
      </View>
    </View>
  );
}

function ProductEditorForm({
  disabled,
  editor,
  onCancel,
  onChange,
  onSave,
}: {
  disabled: boolean;
  editor: ProductEditor;
  onCancel: () => void;
  onChange: (editor: ProductEditor) => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>
        {editor.kind === 'create' ? 'Novo item' : 'Editar item'} ·{' '}
        {editor.category.name}
      </Text>
      <Field
        accessibilityLabel="Nome do item"
        label="Nome"
        onChangeText={(name) => onChange({ ...editor, name })}
        placeholder="Ex.: Suco de laranja"
        value={editor.name}
      />
      <Field
        accessibilityLabel="Descrição do item"
        label="Descrição (opcional)"
        onChangeText={(description) => onChange({ ...editor, description })}
        placeholder="Ex.: Copo 300 ml"
        value={editor.description}
      />
      <Field
        accessibilityLabel="Preço do item"
        keyboardType="number-pad"
        label="Preço em reais"
        onChangeText={(price) => onChange({ ...editor, price: formatCurrencyInput(price) })}
        placeholder="R$ 0,00"
        value={editor.price}
      />
      <View style={styles.editorActions}>
        <ActionButton disabled={disabled} label="Salvar item" onPress={onSave} />
        <ActionButton label="Cancelar" onPress={onCancel} tone="secondary" />
      </View>
    </View>
  );
}

function Field({ accessibilityLabel, keyboardType, label, onChangeText, placeholder, value }: {
  accessibilityLabel: string;
  keyboardType?: 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.placeholder}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ActionButton({ disabled = false, label, onPress, tone = 'primary' }: {
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
        tone === 'secondary' && styles.secondaryButton,
        tone === 'danger' && styles.dangerButton,
        (disabled || pressed) && styles.buttonPressed,
      ]}
    >
      <Text style={[
        styles.buttonText,
        tone === 'secondary' && styles.secondaryButtonText,
        tone === 'danger' && styles.dangerButtonText,
      ]}>{label}</Text>
    </Pressable>
  );
}

function parseBrlCents(value: string) {
  const digits = value.replace(/\D/gu, '');
  if (!digits) {
    return null;
  }
  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : null;
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/gu, '').replace(/^0+(?=\d)/u, '');
  const paddedDigits = digits.padStart(3, '0');
  const integerPart = paddedDigits
    .slice(0, -2)
    .replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
  const decimalPart = paddedDigits.slice(-2);
  return `R$ ${integerPart},${decimalPart}`;
}

function centsInput(value: number) {
  return formatCurrencyInput(String(value));
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, minHeight: 46, paddingHorizontal: 16, paddingVertical: 13 },
  buttonPressed: { opacity: 0.65 },
  buttonText: { color: themeColors.foregroundOnPrimary, fontSize: 14, fontWeight: '800' },
  cardActions: { gap: 8, marginTop: 14 },
  categoryBody: { gap: 12 },
  categoryCard: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 18, borderWidth: 1, gap: 12, padding: 18 },
  categoryHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  categoryHeaderPressed: { opacity: 0.68 },
  categoryName: { color: themeColors.foreground, fontSize: 19, fontWeight: '800' },
  chevron: { color: themeColors.primary, fontSize: 24, fontWeight: '500', lineHeight: 27 },
  content: { alignSelf: 'center', gap: 14, maxWidth: 760, padding: 20, paddingBottom: 48, width: '100%' },
  dangerButton: { backgroundColor: themeColors.dangerSurface, borderColor: themeColors.dangerBorder, borderWidth: 1 },
  dangerButtonText: { color: themeColors.dangerText },
  description: { color: themeColors.foregroundMuted, fontSize: 14, lineHeight: 20 },
  editor: { backgroundColor: themeColors.surfaceAccent, borderColor: themeColors.border, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  editorActions: { gap: 8 },
  editorTitle: { color: themeColors.foreground, fontSize: 17, fontWeight: '800' },
  empty: { color: themeColors.foregroundMuted, fontSize: 15, paddingVertical: 12, textAlign: 'center' },
  eyebrow: { color: themeColors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  field: { gap: 6 },
  fieldLabel: { color: themeColors.foreground, fontSize: 14, fontWeight: '700' },
  headingCopy: { flex: 1, gap: 3 },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  inactive: { opacity: 0.58 },
  input: { backgroundColor: themeColors.surface, borderColor: themeColors.borderStrong, borderRadius: 12, borderWidth: 1, color: themeColors.foreground, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  message: { backgroundColor: themeColors.surfaceAccent, borderRadius: 12, color: themeColors.foregroundBody, fontSize: 14, padding: 12 },
  meta: { color: themeColors.foregroundMuted, fontSize: 13 },
  price: { color: themeColors.primary, fontSize: 15, fontWeight: '800', marginTop: 3 },
  productActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  productName: { color: themeColors.foreground, fontSize: 16, fontWeight: '700' },
  productRow: { alignItems: 'center', borderTopColor: themeColors.divider, borderTopWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingTop: 12 },
  safeArea: { backgroundColor: themeColors.background, flex: 1 },
  secondaryButton: { backgroundColor: 'transparent', borderColor: themeColors.primary, borderWidth: 1 },
  secondaryButtonText: { color: themeColors.primary },
  smallButton: { paddingHorizontal: 8, paddingVertical: 6 },
  smallButtonText: { color: themeColors.primary, fontSize: 13, fontWeight: '800' },
  title: { color: themeColors.foreground, fontSize: 26, fontWeight: '800' },
  warning: { color: themeColors.dangerText, fontSize: 13, fontWeight: '800' },
});
