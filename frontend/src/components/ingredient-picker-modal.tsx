import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RecipeIngredientOption } from '../services/menu-admin-api';
import { themeColors } from '../theme/tokens';

export function IngredientPickerModal({ ingredients, onCancel, onSelect }: {
  ingredients: RecipeIngredientOption[];
  onCancel: () => void;
  onSelect: (ingredient: RecipeIngredientOption) => void;
}) {
  const [search, setSearch] = useState('');
  const normalizedSearch = normalizedText(search);
  const filteredIngredients = ingredients.filter((ingredient) =>
    normalizedText(ingredient.name).includes(normalizedSearch),
  );

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={styles.backdrop}>
        <View
          accessibilityLabel="Janela para adicionar insumo"
          accessibilityViewIsModal
          style={styles.sheet}
        >
          <Text style={styles.title}>Adicionar insumo</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Buscar pelo nome</Text>
            <TextInput
              accessibilityLabel="Buscar insumo por nome"
              autoFocus
              onChangeText={setSearch}
              placeholder="Ex.: Batata"
              placeholderTextColor={themeColors.placeholder}
              style={styles.input}
              value={search}
            />
          </View>

          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {filteredIngredients.map((ingredient) => (
              <Pressable
                accessibilityLabel={`Adicionar insumo ${ingredient.name}`}
                accessibilityRole="button"
                key={ingredient.id}
                onPress={() => onSelect(ingredient)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text style={styles.optionName}>{ingredient.name}</Text>
                <Text style={styles.optionUnit}>{unitLabel(ingredient.unit)}</Text>
              </Pressable>
            ))}
            {filteredIngredients.length === 0 ? (
              <Text style={styles.empty}>
                {ingredients.length === 0
                  ? 'Todos os insumos disponíveis já foram adicionados.'
                  : 'Nenhum insumo encontrado.'}
              </Text>
            ) : null}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function normalizedText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').trim().toLocaleLowerCase('pt-BR');
}

function unitLabel(unit: RecipeIngredientOption['unit']) {
  if (unit === 'GRAM') {
    return 'g';
  }
  if (unit === 'MILLILITER') {
    return 'ml';
  }
  return 'un';
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(30, 22, 16, 0.68)', flex: 1, justifyContent: 'center', padding: 18 },
  cancelButton: { alignItems: 'center', borderColor: themeColors.primary, borderRadius: 12, borderWidth: 1, minHeight: 46, paddingHorizontal: 16, paddingVertical: 13 },
  cancelButtonText: { color: themeColors.primary, fontSize: 14, fontWeight: '800' },
  empty: { color: themeColors.foregroundMuted, fontSize: 14, paddingVertical: 20, textAlign: 'center' },
  field: { gap: 6 },
  fieldLabel: { color: themeColors.foreground, fontSize: 14, fontWeight: '700' },
  input: { backgroundColor: themeColors.surface, borderColor: themeColors.borderStrong, borderRadius: 12, borderWidth: 1, color: themeColors.foreground, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  list: { gap: 8, paddingVertical: 4 },
  option: { alignItems: 'center', backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, paddingHorizontal: 14, paddingVertical: 10 },
  optionName: { color: themeColors.foreground, flex: 1, fontSize: 15, fontWeight: '700' },
  optionUnit: { color: themeColors.foregroundMuted, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  sheet: { backgroundColor: themeColors.background, borderColor: themeColors.borderStrong, borderRadius: 18, borderWidth: 1, gap: 12, maxHeight: '82%', maxWidth: 520, padding: 16, width: '100%' },
  title: { color: themeColors.foreground, fontSize: 18, fontWeight: '800' },
});
