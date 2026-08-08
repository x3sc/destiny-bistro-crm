import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';

export function getLoginLayoutMetrics(windowHeight: number) {
  const compact = windowHeight < 780;
  const veryCompact = windowHeight < 660;
  const heroRatio = veryCompact ? 0.42 : compact ? 0.44 : 0.48;

  return {
    buttonHeight: veryCompact ? 48 : compact ? 52 : 58,
    buttonMarginTop: compact ? 8 : 14,
    cardOverlap: compact ? -34 : -44,
    cardPaddingBottom: compact ? 16 : 24,
    cardPaddingTop: veryCompact ? 28 : compact ? 34 : 46,
    descriptionFontSize: veryCompact ? 14 : compact ? 15 : 17,
    footerPaddingTop: compact ? 10 : 18,
    heroGap: veryCompact ? 7 : compact ? 10 : 14,
    heroHeight: Math.max(245, Math.min(510, Math.round(windowHeight * heroRatio))),
    heroPaddingTop: veryCompact ? 12 : compact ? 18 : 30,
    inputHeight: veryCompact ? 46 : compact ? 48 : 52,
    labelFontSize: veryCompact ? 15 : compact ? 16 : 17,
    logoSize: veryCompact ? 56 : compact ? 64 : 78,
    titleFontSize: veryCompact ? 42 : compact ? 48 : 56,
  };
}

export function LoginScreen({
  onLogin,
}: {
  onLogin(name: string, password: string): Promise<void>;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const layout = getLoginLayoutMetrics(windowHeight);
  const horizontalPadding = windowWidth < 360 ? 22 : 32;
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ImageBackground
            resizeMode="cover"
            source={require('../../assets/images/figma/login-background.png')}
            style={[
              styles.hero,
              {
                height: layout.heroHeight,
                paddingTop: layout.heroPaddingTop,
              },
            ]}
          >
            <View style={styles.heroOverlay} />
            <View style={[styles.heroContent, { gap: layout.heroGap }]}>
              <Image
                accessibilityLabel="Logo Destiny"
                resizeMode="contain"
                source={require('../../assets/images/figma/destiny-logo.png')}
                style={{ height: layout.logoSize, width: layout.logoSize }}
              />
              <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
              <Text
                style={[
                  styles.title,
                  {
                    fontSize: layout.titleFontSize,
                    lineHeight: layout.titleFontSize * 1.08,
                  },
                ]}
              >
                Entrar
              </Text>
              <Text
                style={[
                  styles.description,
                  {
                    fontSize: layout.descriptionFontSize,
                    lineHeight: layout.descriptionFontSize * 1.25,
                  },
                ]}
              >
                Use o usuário cadastrado pela administração
              </Text>
            </View>
          </ImageBackground>

          <View
            style={[
              styles.card,
              {
                marginTop: layout.cardOverlap,
                paddingBottom: layout.cardPaddingBottom,
                paddingHorizontal: horizontalPadding,
                paddingTop: layout.cardPaddingTop,
              },
            ]}
          >
            <Text style={[styles.label, { fontSize: layout.labelFontSize }]}>Nome</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={themeColors.placeholder}
              style={[styles.input, { minHeight: layout.inputHeight }]}
              testID="login-name"
              value={name}
            />

            <Text style={[styles.label, { fontSize: layout.labelFontSize }]}>Senha</Text>
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
              style={[styles.input, { minHeight: layout.inputHeight }]}
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
                {
                  marginTop: layout.buttonMarginTop,
                  minHeight: layout.buttonHeight,
                },
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

            <Text
              style={[styles.footer, { paddingTop: layout.footerPaddingTop }]}
            >
              Desenvolvido por @destinyin.ofc
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: themeColors.accent,
    borderRadius: 22,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    alignSelf: 'center',
    backgroundColor: themeColors.surfaceMuted,
    borderTopLeftRadius: 46,
    borderTopRightRadius: 46,
    flexGrow: 1,
    gap: 8,
    maxWidth: 540,
    width: '100%',
  },
  description: {
    color: themeColors.foregroundOnPrimary,
    fontWeight: '600',
    maxWidth: 430,
    textAlign: 'center',
  },
  error: {
    color: themeColors.dangerText,
    fontSize: 14,
  },
  eyebrow: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    color: themeColors.placeholder,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 'auto',
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  heroOverlay: {
    backgroundColor: 'rgba(101, 6, 12, 0.34)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  input: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 16,
    paddingHorizontal: 24,
  },
  keyboardAvoidingView: { flex: 1 },
  label: {
    color: themeColors.primary,
    fontWeight: '800',
    marginTop: 2,
    paddingLeft: 24,
  },
  safeArea: {
    backgroundColor: themeColors.primary,
    flex: 1,
  },
  scrollContent: {
    backgroundColor: themeColors.primary,
    flexGrow: 1,
  },
  title: {
    color: themeColors.foregroundOnPrimary,
    fontWeight: '900',
    letterSpacing: -2,
  },
});
