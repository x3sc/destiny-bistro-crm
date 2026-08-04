import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';
import { ScreenBackButton } from './screen-back-button';

export function AdminHomeScreen({
  canManageMenu,
  canReadStatements,
  onBack,
  onMenu,
  onStatement,
}: {
  canManageMenu: boolean;
  canReadStatements: boolean;
  onBack: () => void;
  onMenu: () => void;
  onStatement: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ScreenBackButton onPress={onBack} />
        <Text style={styles.eyebrow}>Gestão do estabelecimento</Text>
        <Text style={styles.title}>Administrativo</Text>
        <Text style={styles.description}>
          Consulte o movimento de hoje e mantenha o cardápio atualizado.
        </Text>

        <View style={styles.cards}>
          {canReadStatements && (
            <AdminCard
              description="Vendas, recebimentos e comandas do dia atual."
              label="Extrato do dia"
              onPress={onStatement}
            />
          )}
          {canManageMenu && (
            <AdminCard
              description="Crie categorias e cadastre os itens e valores de cada uma."
              label="Cardápio"
              onPress={onMenu}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function AdminCard({
  description,
  label,
  onPress,
}: {
  description: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  cardDescription: {
    color: themeColors.foregroundMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  cardTitle: {
    color: themeColors.foreground,
    fontSize: 21,
    fontWeight: '800',
  },
  cards: { gap: 14, marginTop: 28 },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 680,
    padding: 22,
    width: '100%',
  },
  description: {
    color: themeColors.foregroundMuted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
  },
  eyebrow: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  safeArea: { backgroundColor: themeColors.background, flex: 1 },
  title: {
    color: themeColors.foreground,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 10,
  },
});
