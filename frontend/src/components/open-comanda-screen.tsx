import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openComanda, type Comanda } from '../services/comandas-api';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { themeColors } from '../theme/tokens';
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
      <View style={styles.content}>
        <ScreenBackButton onPress={onBack} />
        <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
        <Text style={styles.title}>Abrir comanda</Text>

        {!normalizedApiBaseUrl && (
          <Text style={styles.error}>
            Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo.
          </Text>
        )}

        {!isValidTable && <Text style={styles.error}>Mesa inválida.</Text>}

        {normalizedApiBaseUrl && isValidTable && (
          <>
            <View style={styles.card}>
              <Text style={styles.table}>Mesa {tableNumber}</Text>
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

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <ActionButton
                disabled={isSubmitting}
                label={isSubmitting ? 'Abrindo...' : 'Confirmar abertura'}
                onPress={() => {
                  void submit();
                }}
              />
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
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  content: {
    flex: 1,
    gap: 16,
    padding: 20,
  },
  eyebrow: {
    color: themeColors.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: themeColors.foreground,
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    backgroundColor: themeColors.surface,
    borderRadius: 12,
    gap: 8,
    padding: 16,
  },
  table: {
    color: themeColors.foreground,
    fontSize: 21,
    fontWeight: '700',
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
    borderRadius: 10,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    backgroundColor: themeColors.dangerSurface,
    borderRadius: 12,
    color: themeColors.dangerText,
    padding: 16,
  },
  actions: {
    gap: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 12,
    padding: 16,
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
});
