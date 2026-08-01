import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';

export function LoginScreen({
  onLogin,
}: {
  onLogin(name: string, password: string): Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!name.trim() || password.length < 8 || loading) {
      setError('Informe seu nome e sua senha.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onLogin(name, password);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.description}>
          Use o usuário cadastrado pela administração.
        </Text>

        <Text style={styles.label}>Nome</Text>
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          editable={!loading}
          onChangeText={setName}
          placeholder="Seu nome"
          placeholderTextColor={themeColors.placeholder}
          style={styles.input}
          testID="login-name"
          value={name}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          onChangeText={setPassword}
          onSubmitEditing={() => {
            void submit();
          }}
          placeholder="Sua senha"
          placeholderTextColor={themeColors.placeholder}
          secureTextEntry
          style={styles.input}
          testID="login-password"
          value={password}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => {
            void submit();
          }}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={themeColors.foregroundOnPrimary} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function AuthLoadingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ActivityIndicator color={themeColors.primaryActivity} size="large" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 14,
    marginTop: 10,
    minHeight: 52,
    padding: 15,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    maxWidth: 460,
    padding: 24,
    width: '90%',
  },
  description: {
    color: themeColors.foregroundMuted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 12,
  },
  error: {
    color: themeColors.dangerText,
    fontSize: 14,
  },
  eyebrow: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  label: {
    color: themeColors.foregroundBody,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  safeArea: {
    alignItems: 'center',
    backgroundColor: themeColors.background,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: themeColors.foreground,
    fontSize: 32,
    fontWeight: '800',
  },
});
