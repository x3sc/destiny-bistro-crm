import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createMenuAdditional,
  deactivateMenuAdditional,
  loadAdminMenu,
  loadMenuAdditionals,
  loadRecipeIngredients,
  replaceAdditionalRecipe,
  replaceProductAdditionals,
  replaceProductRecipe,
  type MenuAdditional,
  type MenuProduct,
  type RecipeIngredientOption,
} from '../services/menu-admin-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';

type RecipeValues = Record<string, string>;

export function RecipeManagementScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  onBack,
}: {
  apiBaseUrl?: string;
  onBack: () => void;
}) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [products, setProducts] = useState<MenuProduct[]>();
  const [additionals, setAdditionals] = useState<MenuAdditional[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredientOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct>();
  const [selectedAdditional, setSelectedAdditional] = useState<MenuAdditional>();
  const [recipe, setRecipe] = useState<RecipeValues>({});
  const [allowedIds, setAllowedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [newAdditional, setNewAdditional] = useState({ code: '', name: '', price: '' });

  const refresh = useCallback(() => {
    if (!baseUrl) return Promise.reject(new Error('API não configurada'));
    return Promise.all([
      loadAdminMenu(baseUrl),
      loadMenuAdditionals(baseUrl),
      loadRecipeIngredients(baseUrl),
    ]).then(([categories, nextAdditionals, nextIngredients]) => {
      setProducts(categories.flatMap(({ products: values }) => values));
      setAdditionals(nextAdditionals);
      setIngredients(nextIngredients);
    });
  }, [baseUrl]);

  useEffect(() => {
    void refresh().catch(() => setMessage('Não foi possível carregar receitas e adicionais.'));
  }, [refresh]);

  const selectProduct = (product: MenuProduct) => {
    setSelectedAdditional(undefined);
    setSelectedProduct(product);
    setRecipe(recipeValues(product.recipe ?? []));
    setAllowedIds(product.additionals?.map(({ id }) => id) ?? []);
  };
  const selectAdditional = (additional: MenuAdditional) => {
    setSelectedProduct(undefined);
    setSelectedAdditional(additional);
    setRecipe(recipeValues(additional.recipe));
  };
  const mutate = async (request: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await request();
      await refresh();
      setSelectedProduct(undefined);
      setSelectedAdditional(undefined);
      setRecipe({});
      setMessage(success);
    } catch {
      setMessage('Não foi possível salvar. Confira os dados e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Defina fichas técnicas e quais adicionais podem ser vendidos em cada produto"
        onBack={onBack}
        title="Receitas e adicionais"
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {!products ? <ActivityIndicator color={themeColors.primary} /> : null}

        <View style={styles.section}>
          <Text style={styles.title}>Produtos</Text>
          <Text style={styles.description}>Selecione um produto para editar sua receita e adicionais permitidos.</Text>
          <View style={styles.wrap}>
            {products?.map((product) => (
              <Choice key={product.id} label={`${product.name}${product.recipe?.length ? '' : ' · sem ficha'}`} onPress={() => selectProduct(product)} selected={selectedProduct?.id === product.id} />
            ))}
          </View>
        </View>

        {selectedProduct ? (
          <View style={styles.editor}>
            <Text style={styles.title}>{selectedProduct.name}</Text>
            <RecipeFields ingredients={ingredients} onChange={setRecipe} values={recipe} />
            <Text style={styles.subtitle}>Adicionais permitidos</Text>
            <View style={styles.wrap}>
              {additionals.filter(({ active }) => active).map((additional) => (
                <Choice
                  key={additional.id}
                  label={`${additional.name} · ${formatCentsAsBrl(additional.priceCents)}`}
                  onPress={() => setAllowedIds((current) => current.includes(additional.id) ? current.filter((id) => id !== additional.id) : [...current, additional.id])}
                  selected={allowedIds.includes(additional.id)}
                />
              ))}
            </View>
            <Button disabled={busy} label="Salvar produto" onPress={() => baseUrl && void mutate(async () => {
              await replaceProductRecipe(baseUrl, selectedProduct.id, normalizedRecipe(recipe));
              await replaceProductAdditionals(baseUrl, selectedProduct.id, allowedIds);
            }, 'Receita e adicionais do produto salvos.')} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.title}>Catálogo de adicionais</Text>
          <View style={styles.editor}>
            <TextInput accessibilityLabel="Código do adicional" onChangeText={(code) => setNewAdditional((value) => ({ ...value, code }))} placeholder="Código" style={styles.input} value={newAdditional.code} />
            <TextInput accessibilityLabel="Nome do adicional" onChangeText={(name) => setNewAdditional((value) => ({ ...value, name }))} placeholder="Nome" style={styles.input} value={newAdditional.name} />
            <TextInput accessibilityLabel="Preço do adicional em centavos" keyboardType="number-pad" onChangeText={(price) => setNewAdditional((value) => ({ ...value, price }))} placeholder="Preço em centavos" style={styles.input} value={newAdditional.price} />
            <Button disabled={busy} label="Criar adicional" onPress={() => baseUrl && void mutate(() => createMenuAdditional(baseUrl, { code: newAdditional.code, name: newAdditional.name, priceCents: Number(newAdditional.price) }), 'Adicional criado.')} />
          </View>
          <View style={styles.wrap}>
            {additionals.map((additional) => (
              <Choice key={additional.id} label={`${additional.name} · ${additional.active ? formatCentsAsBrl(additional.priceCents) : 'inativo'}`} onPress={() => selectAdditional(additional)} selected={selectedAdditional?.id === additional.id} />
            ))}
          </View>
        </View>

        {selectedAdditional ? (
          <View style={styles.editor}>
            <Text style={styles.title}>Receita · {selectedAdditional.name}</Text>
            <RecipeFields ingredients={ingredients} onChange={setRecipe} values={recipe} />
            <Button disabled={busy} label="Salvar receita do adicional" onPress={() => baseUrl && void mutate(() => replaceAdditionalRecipe(baseUrl, selectedAdditional.id, normalizedRecipe(recipe)), 'Receita do adicional salva.')} />
            {selectedAdditional.active ? <Button disabled={busy} label="Desativar adicional" onPress={() => baseUrl && void mutate(() => deactivateMenuAdditional(baseUrl, selectedAdditional.id), 'Adicional desativado.')} secondary /> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecipeFields({ ingredients, onChange, values }: { ingredients: RecipeIngredientOption[]; onChange: (value: RecipeValues) => void; values: RecipeValues }) {
  return <View style={styles.fields}>{ingredients.map((ingredient) => <View key={ingredient.id} style={styles.fieldRow}><Text style={styles.fieldLabel}>{ingredient.name} ({unitLabel(ingredient.unit)})</Text><TextInput accessibilityLabel={`Quantidade de ${ingredient.name}`} keyboardType="number-pad" onChangeText={(value) => onChange({ ...values, [ingredient.id]: value })} placeholder="0" style={styles.quantityInput} value={values[ingredient.id] ?? ''} /></View>)}</View>;
}
function Choice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{selected ? '✓ ' : ''}{label}</Text></Pressable>; }
function Button({ disabled, label, onPress, secondary }: { disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{label}</Text></Pressable>; }
function recipeValues(recipe: { ingredient: { id: string }; quantity: number }[]) { return Object.fromEntries(recipe.map(({ ingredient, quantity }) => [ingredient.id, String(quantity)])); }
function normalizedRecipe(values: RecipeValues) { return Object.entries(values).filter(([, value]) => Number(value) > 0 && Number.isInteger(Number(value))).map(([ingredientId, value]) => ({ ingredientId, quantity: Number(value) })); }
function unitLabel(unit: RecipeIngredientOption['unit']) { return unit === 'GRAM' ? 'g' : unit === 'MILLILITER' ? 'ml' : 'un'; }

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: themeColors.primary, borderRadius: 12, minHeight: 46, justifyContent: 'center', paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: themeColors.surfaceAccent },
  buttonSecondaryText: { color: themeColors.primary },
  buttonText: { color: themeColors.foregroundOnPrimary, fontWeight: '800' },
  choice: { backgroundColor: themeColors.surfaceAccent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  choiceSelected: { backgroundColor: themeColors.primary },
  choiceText: { color: themeColors.primary, fontSize: 13, fontWeight: '700' },
  choiceTextSelected: { color: themeColors.foregroundOnPrimary },
  content: { alignSelf: 'center', flexGrow: 1, gap: 18, maxWidth: 900, padding: 22, width: '100%' },
  description: { color: themeColors.foregroundMuted, fontSize: 14, lineHeight: 20 },
  disabled: { opacity: 0.5 },
  editor: { backgroundColor: themeColors.surfaceMuted, borderRadius: 16, gap: 12, padding: 16 },
  fieldLabel: { color: themeColors.foreground, flex: 1, fontWeight: '700' },
  fieldRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  fields: { gap: 9 },
  input: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 12, borderWidth: 1, color: themeColors.foreground, minHeight: 46, paddingHorizontal: 12 },
  message: { backgroundColor: themeColors.surfaceAccent, borderRadius: 12, color: themeColors.foreground, padding: 12 },
  quantityInput: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 10, borderWidth: 1, minHeight: 42, paddingHorizontal: 10, width: 90 },
  safeArea: { backgroundColor: themeColors.primary, flex: 1 },
  section: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 18, borderWidth: 1, gap: 12, padding: 16 },
  subtitle: { color: themeColors.foreground, fontSize: 15, fontWeight: '800' },
  title: { color: themeColors.primary, fontSize: 20, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
