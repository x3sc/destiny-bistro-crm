import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';

export function MainMenuScreen({
  canAccessAdmin = true,
  canAccessCredits = true,
  canAccessDeliveries = true,
  canAccessTables = true,
  establishmentName,
  onAdmin,
  onCredits,
  onDeliveries,
  onLogout,
  onTables,
  userName,
}: {
  canAccessAdmin?: boolean;
  canAccessCredits?: boolean;
  canAccessDeliveries?: boolean;
  canAccessTables?: boolean;
  establishmentName?: string;
  onAdmin: () => void;
  onCredits: () => void;
  onDeliveries: () => void;
  onLogout?: () => void;
  onTables: () => void;
  userName?: string;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.brandRow}>
            <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
            {userName ? (
              <AppIcon
                color={themeColors.foregroundOnPrimary}
                name="user"
                size={58}
              />
            ) : null}
          </View>
          <Text style={styles.title}>
            {userName
              ? `Olá, bem-vindo(a), ${userName}, ao seu menu principal`
              : 'Olá, bem-vindo(a) ao seu menu principal'}
          </Text>
          {establishmentName ? (
            <Text style={styles.establishmentName}>{establishmentName}</Text>
          ) : null}
          {userName ? (
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
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>Escolha a área que deseja acessar</Text>

        <View style={styles.cards}>
          {canAccessTables && (
            <MenuCard
              description="Abra e acompanhe as comandas do salão."
              icon="tables"
              label="Mesas"
              onPress={onTables}
            />
          )}
          {canAccessCredits && (
            <MenuCard
              description="Registre pedidos e acompanhe valores a receber."
              icon="credits"
              label="Fiados"
              onPress={onCredits}
            />
          )}
          {canAccessDeliveries && (
            <MenuCard
              description="Organize pedidos, entregadores, entregas e o acerto do dia."
              icon="delivery"
              label="Delivery"
              onPress={onDeliveries}
            />
          )}
          {canAccessAdmin && (
            <MenuCard
              description="Consulte o extrato do dia e gerencie categorias, itens e valores."
              icon="admin"
              label="Administrativo"
              onPress={onAdmin}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuCard({
  description,
  disabled = false,
  icon,
  label,
  onPress,
}: {
  description: string;
  disabled?: boolean;
  icon: 'admin' | 'credits' | 'delivery' | 'tables';
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
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
        <AppIcon color={themeColors.accent} name={icon} size={22} />
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.cardTitle}
        >
          {label}
        </Text>
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
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    minHeight: 144,
    padding: 20,
  },
  cardDescription: {
    color: themeColors.foreground,
    fontSize: 15,
    lineHeight: 20,
  },
  cardHeading: {
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    color: themeColors.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cards: {
    gap: 16,
    marginTop: 14,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 760,
    paddingBottom: 40,
    paddingHorizontal: 25,
    paddingTop: 26,
    width: '100%',
  },
  description: {
    color: themeColors.primary,
    fontSize: 17,
    paddingHorizontal: 25,
  },
  disabledCard: {
    opacity: 0.65,
  },
  eyebrow: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 16,
    fontWeight: '300',
  },
  establishmentName: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  logout: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
  },
  pressedCard: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  safeArea: {
    backgroundColor: themeColors.primary,
    flex: 1,
  },
  session: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sessionText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
  },
  title: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 34,
    maxWidth: 520,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hero: {
    backgroundColor: themeColors.primary,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
  },
  heroContent: {
    alignSelf: 'center',
    gap: 10,
    maxWidth: 760,
    paddingBottom: 22,
    paddingHorizontal: 26,
    paddingTop: 18,
    width: '100%',
  },
});
