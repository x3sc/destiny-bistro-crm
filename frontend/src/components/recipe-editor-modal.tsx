import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { MenuProduct, RecipeIngredientOption } from '../services/menu-admin-api';
import { themeColors } from '../theme/tokens';
import { IngredientPickerModal } from './ingredient-picker-modal';

export interface RecipeEditorState {
  product: MenuProduct;
  values: Record<string, string>;
}

export function RecipeEditorModal({
  disabled,
  editor,
  ingredients,
  message,
  onCancel,
  onChange,
  onSave,
}: {
  disabled: boolean;
  editor: RecipeEditorState;
  ingredients?: RecipeIngredientOption[];
  message?: string;
  onCancel: () => void;
  onChange: (editor: RecipeEditorState) => void;
  onSave: () => void;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const selectedIngredients = ingredients?.filter((ingredient) =>
    Object.prototype.hasOwnProperty.call(editor.values, ingredient.id),
  );
  const availableIngredients = ingredients?.filter((ingredient) =>
    !Object.prototype.hasOwnProperty.call(editor.values, ingredient.id),
  );

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={styles.backdrop}>
        <View
          accessibilityLabel={`Janela de receita de ${editor.product.name}`}
          accessibilityViewIsModal
          style={styles.sheet}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Receita - {editor.product.name}</Text>
            <Text style={styles.description}>
              Informe o consumo de cada insumo por unidade vendida.
            </Text>

            {message ? <Text style={styles.message}>{message}</Text> : null}
            {!ingredients && !message ? (
              <ActivityIndicator color={themeColors.primary} size="large" />
            ) : null}
            {ingredients?.length === 0 ? (
              <Text style={styles.empty}>Nenhum insumo ativo cadastrado no estoque.</Text>
            ) : null}

            {selectedIngredients?.length === 0 ? (
              <Text style={styles.empty}>Nenhum insumo adicionado à receita.</Text>
            ) : null}

            {selectedIngredients?.map((ingredient) => (
              <View key={ingredient.id} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>
                  {ingredient.name} ({unitLabel(ingredient.unit)})
                </Text>
                <TextInput
                  accessibilityLabel={`Quantidade de ${ingredient.name}`}
                  keyboardType="number-pad"
                  onChangeText={(value) => onChange({
                    ...editor,
                    values: { ...editor.values, [ingredient.id]: value },
                  })}
                  placeholder="0"
                  placeholderTextColor={themeColors.placeholder}
                  style={styles.input}
                  value={editor.values[ingredient.id] ?? ''}
                />
              </View>
            ))}

            <View style={styles.actions}>
              <ModalButton
                disabled={disabled || !ingredients || ingredients.length === 0}
                label="Adicionar insumo"
                onPress={() => setPickerVisible(true)}
                secondary
              />
              <ModalButton disabled={disabled || !ingredients} label="Salvar receita" onPress={onSave} />
              <ModalButton label="Cancelar receita" onPress={onCancel} secondary />
            </View>
          </ScrollView>
        </View>
      </View>

      {pickerVisible && availableIngredients ? (
        <IngredientPickerModal
          ingredients={availableIngredients}
          onCancel={() => setPickerVisible(false)}
          onSelect={(ingredient) => {
            onChange({ ...editor, values: { ...editor.values, [ingredient.id]: '' } });
            setPickerVisible(false);
          }}
        />
      ) : null}
    </Modal>
  );
}

function ModalButton({ disabled = false, label, onPress, secondary = false }: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || pressed) && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
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
  actions: { gap: 8, marginTop: 4 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(30, 22, 16, 0.58)', flex: 1, justifyContent: 'center', padding: 18 },
  button: { alignItems: 'center', backgroundColor: themeColors.primary, borderColor: themeColors.primary, borderRadius: 12, borderWidth: 1, minHeight: 46, paddingHorizontal: 16, paddingVertical: 13 },
  buttonText: { color: themeColors.foregroundOnPrimary, fontSize: 14, fontWeight: '800' },
  content: { gap: 12, padding: 16 },
  description: { color: themeColors.foregroundMuted, fontSize: 14, lineHeight: 20 },
  empty: { color: themeColors.foregroundMuted, fontSize: 14, paddingVertical: 12, textAlign: 'center' },
  fieldLabel: { color: themeColors.foreground, flex: 1, fontSize: 14, fontWeight: '700' },
  fieldRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  input: { backgroundColor: themeColors.surface, borderColor: themeColors.borderStrong, borderRadius: 12, borderWidth: 1, color: themeColors.foreground, fontSize: 15, minHeight: 46, paddingHorizontal: 12, textAlign: 'right', width: 92 },
  message: { color: themeColors.dangerText, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  secondaryButton: { backgroundColor: 'transparent' },
  secondaryButtonText: { color: themeColors.primary },
  sheet: { backgroundColor: themeColors.background, borderColor: themeColors.borderStrong, borderRadius: 18, borderWidth: 1, maxHeight: '90%', maxWidth: 560, overflow: 'hidden', width: '100%' },
  title: { color: themeColors.foreground, fontSize: 18, fontWeight: '800' },
});
