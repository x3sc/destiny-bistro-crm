import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openComanda, type Comanda } from '../services/comandas-api';
import { normalizeApiBaseUrl } from '../services/api-base-url';

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
                placeholderTextColor="#8c817b"
                style={styles.input}
                value={name}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f2eb',
  },
  content: {
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#795548',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#2f241f',
    fontSize: 32,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 8,
    padding: 20,
  },
  table: {
    color: '#2f241f',
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    color: '#5d514b',
    fontSize: 16,
    lineHeight: 24,
  },
  inputLabel: {
    color: '#2f241f',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#b8aaa1',
    borderRadius: 10,
    borderWidth: 1,
    color: '#2f241f',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    backgroundColor: '#f8d7da',
    borderRadius: 12,
    color: '#842029',
    padding: 16,
  },
  actions: {
    gap: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 12,
    padding: 16,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#6f4e37',
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#6f4e37',
  },
});
