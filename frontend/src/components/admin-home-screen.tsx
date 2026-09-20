import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';
import { BrandedScreenHeader } from './branded-screen-header';

export function AdminHomeScreen({
  bottomNavigation,
  canManageMenu,
  canManageUsers,
  onUsers,
  canReadInventory,
  canReadStatements,
  onBack,
  onMenu,
  onInventory,
  onStatement,
}: {
  bottomNavigation?: ReactNode;
  canManageMenu: boolean;
  canManageUsers: boolean;
  onUsers: () => void;
  canReadInventory: boolean;
  canReadStatements: boolean;
  onBack: () => void;
  onMenu: () => void;
  onInventory: () => void;
  onStatement: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Acompanhe a operação e gerencie seu estabelecimento"
        onBack={onBack}
        title="Administrativo"
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
          {canReadInventory && (
            <AdminCard
              description="Acompanhe saldos, déficits, lotes, entradas, perdas e ajustes."
              label="Estoque"
              onPress={onInventory}
            />
          )}
          {canManageUsers && (
            <AdminCard description="Cadastre pessoas e defina seus perfis de acesso." label="Usuários" onPress={onUsers} />
          )}
        </View>
      </ScrollView>
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
    minHeight: 94,
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  scroll: { flex: 1, backgroundColor: themeColors.background },
  cards: { gap: 16 },
  content: {
    alignSelf: 'center',
    backgroundColor: themeColors.background,
    flexGrow: 1,
    paddingVertical: 24,
    maxWidth: 760,
    paddingHorizontal: 25,
    width: '100%',
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  safeArea: { backgroundColor: themeColors.primary, flex: 1 },
});
