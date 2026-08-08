import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';
import { BrandedScreenHeader } from './branded-screen-header';

export function AdminHomeScreen({
  bottomNavigation,
  canManageMenu,
  canReadStatements,
  onBack,
  onMenu,
  onStatement,
}: {
  bottomNavigation?: ReactNode;
  canManageMenu: boolean;
  canReadStatements: boolean;
  onBack: () => void;
  onMenu: () => void;
  onStatement: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Consulte o movimento de hoje e mantenha o cardápio atualizado"
        onBack={onBack}
        title="Administrativo"
      />
      <View style={styles.content}>
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
      {bottomNavigation}
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
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeading}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.cardTitle}
        >
          {label}
        </Text>
        <AppIcon
          color={themeColors.accent}
          name="external"
          size={22}
        />
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    minHeight: 134,
    padding: 20,
  },
  cardDescription: {
    color: themeColors.foregroundMuted,
    fontSize: 16,
    lineHeight: 22,
  },
  cardTitle: {
    color: themeColors.primary,
    flex: 1,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  cards: { gap: 16, marginTop: 40 },
  content: {
    alignSelf: 'center',
    backgroundColor: themeColors.background,
    flex: 1,
    maxWidth: 760,
    paddingHorizontal: 25,
    width: '100%',
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  safeArea: { backgroundColor: themeColors.primary, flex: 1 },
});
