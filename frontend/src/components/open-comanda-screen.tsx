import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openComanda, type Comanda } from '../services/comandas-api';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  themeColors,
  themeRadii,
  themeSpacing,
  themeTypography,
} from '../theme/tokens';
import { ScreenBackButton } from './screen-back-button';

interface OpenComandaScreenProps {
  apiBaseUrl?: string;
  onBack: () => void;
  onOpened: (comanda: Comanda) => void;
  openRequest?: typeof openComanda;
  tableId: number;
  tableNumber: number;
}

export function OpenComandaScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  onBack,
  onOpened,
  openRequest = openComanda,
  tableId,
  tableNumber,
}: OpenComandaScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const isValidTable = Number.isInteger(tableId) && tableId > 0 && Number.isInteger(tableNumber);

  const submit = async () => {
    if (!normalizedApiBaseUrl || !isValidTable) {
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      onOpened(await openRequest(normalizedApiBaseUrl, tableId, name.trim()));
    } catch {
      setError('Não foi possível abrir a comanda.');
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header} testID="open-comanda-header">
        <ScreenBackButton
          accessibilityLabel="Voltar para mesas"
          onPress={onBack}
          tone="light"
        />
        <Text numberOfLines={1} style={styles.title}>
          Abrir comanda
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.content}>
        {!normalizedApiBaseUrl && (
          <Text style={styles.error}>
            Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo.
          </Text>
        )}

        {!isValidTable && <Text style={styles.error}>Mesa inválida.</Text>}

        {normalizedApiBaseUrl && isValidTable && (
          <>
            <View style={styles.card} testID="open-comanda-card">
              <View style={styles.tableHeading}>
                <Text style={styles.table}>Mesa {tableNumber}</Text>
                <Text style={styles.freeBadge}>Livre</Text>
              </View>
              <Text style={styles.description}>
                Confirme a abertura de uma nova comanda para esta mesa.
              </Text>
              <Text style={styles.inputLabel}>Nome da mesa (opcional)</Text>
              <TextInput
                accessibilityLabel="Nome da mesa (opcional)"
                autoCapitalize="words"
                editable={!isSubmitting}
                maxLength={80}
                onChangeText={setName}
                placeholder="Ex.: João ou Família Silva"
                placeholderTextColor={themeColors.placeholder}
                style={styles.input}
                value={name}
              />
            </View>

            <Text style={styles.helper}>
              Você poderá adicionar produtos depois de abrir a comanda.
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <ActionButton
                disabled={isSubmitting}
                label={isSubmitting ? 'Abrindo...' : 'Confirmar abertura'}
                onPress={() => {
                  void submit();
                }}
              />
              <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
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
      <Text
        style={[
          styles.buttonText,
          tone === 'secondary' && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: themeColors.primary,
  },
  content: {
    backgroundColor: themeColors.background,
    flex: 1,
    gap: themeSpacing.lg,
    padding: themeSpacing.mobileMargin,
  },
  header: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderBottomColor: themeColors.accent,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: themeSpacing.sm,
    minHeight: 56,
    paddingHorizontal: themeSpacing.mobileMargin,
  },
  title: {
    color: themeColors.foregroundOnPrimary,
    flex: 1,
    textAlign: 'center',
    ...themeTypography.sectionTitle,
  },
  headerSpacer: {
    width: themeSpacing.touchTargetMin,
  },
  card: {
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.border,
    borderRadius: themeRadii.standard,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  tableHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  table: {
    color: themeColors.foreground,
    fontSize: 21,
    fontWeight: '700',
  },
  freeBadge: {
    backgroundColor: themeColors.statusFreeBadge,
    borderColor: themeColors.statusFreeBorder,
    borderRadius: themeRadii.pill,
    borderWidth: 1,
    color: themeColors.statusFreeText,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  description: {
    color: themeColors.foregroundMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  inputLabel: {
    color: themeColors.foreground,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  input: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: themeRadii.standard,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 15,
    paddingHorizontal: 14,
    minHeight: 48,
    paddingVertical: 12,
  },
  helper: {
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.divider,
    borderRadius: themeRadii.standard,
    borderWidth: 1,
    color: themeColors.foregroundMuted,
    fontSize: 13,
    lineHeight: 19,
    padding: 16,
  },
  error: {
    backgroundColor: themeColors.dangerSurface,
    borderRadius: themeRadii.compact,
    color: themeColors.dangerText,
    padding: 16,
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
    borderRadius: themeRadii.standard,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secondaryButton: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.primary,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.8,
  },
  buttonText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: themeColors.primary,
  },
});
