import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';

export function MainMenuScreen({
  canAccessCredits = true,
  canAccessStatements = true,
  canAccessTables = true,
  establishmentName,
  onCredits,
  onLogout,
  onStatements,
  onTables,
  userName,
}: {
  canAccessCredits?: boolean;
  canAccessStatements?: boolean;
  canAccessTables?: boolean;
  establishmentName?: string;
  onCredits: () => void;
  onLogout?: () => void;
  onStatements: () => void;
  onTables: () => void;
  userName?: string;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
        <Text style={styles.title}>Menu principal</Text>
        {establishmentName && (
          <Text style={styles.establishmentName}>{establishmentName}</Text>
        )}
        {userName && (
          <View style={styles.session}>
            <Text style={styles.sessionText}>Conectado como {userName}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={styles.logoutButton}
            >
              <Text style={styles.logout}>Sair</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.description}>
          Escolha a área que deseja acessar.
        </Text>

        <View style={styles.cards}>
          {canAccessTables && (
            <MenuCard
              description="Abra e acompanhe as comandas do salão."
              label="Mesas"
              onPress={onTables}
            />
          )}
          {canAccessCredits && (
            <MenuCard
              description="Registre pedidos e acompanhe valores a receber."
              label="Fiados"
              onPress={onCredits}
            />
          )}
          {canAccessStatements && (
            <MenuCard
              description="Consulte vendas, recebimentos e comandas por período."
              label="Extratos"
              onPress={onStatements}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function MenuCard({
  description,
  disabled = false,
  label,
  onPress,
}: {
  description: string;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.disabledCard,
        pressed && !disabled && styles.pressedCard,
      ]}
    >
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{label}</Text>
        {disabled && <Text style={styles.badge}>Em breve</Text>}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: themeColors.surfaceAccent,
    borderRadius: 999,
    color: themeColors.primary,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
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
  cardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: themeColors.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
  cards: {
    gap: 14,
    marginTop: 24,
  },
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
    marginTop: 8,
  },
  disabledCard: {
    opacity: 0.65,
  },
  eyebrow: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  establishmentName: {
    color: themeColors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  logout: {
    color: themeColors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  pressedCard: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  safeArea: {
    backgroundColor: themeColors.background,
    flex: 1,
  },
  session: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sessionText: {
    color: themeColors.foregroundMuted,
    fontSize: 14,
  },
  title: {
    color: themeColors.foreground,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 12,
  },
});
