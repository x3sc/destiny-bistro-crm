import { hasPermission, useAuth } from '../auth/auth-context';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  themeColors,
  themeRadii,
  themeSpacing,
  themeTypography,
} from '../theme/tokens';
import { OperationalText as Text } from '../theme/operational-typography';
import { AppIcon, type AppIconName } from './app-icon';

export type AppNavigationItem =
  | 'admin'
  | 'credits'
  | 'home'
  | 'quick-sales'
  | 'tables';

const navigationItems: {
  destination: Href;
  icon: AppIconName;
  key: AppNavigationItem;
  label: string;
  permission?: string;
}[] = [
  { destination: '/' as Href, icon: 'home', key: 'home', label: 'Início' },
  {
    destination: '/tables' as Href,
    icon: 'tables',
    key: 'tables',
    label: 'Mesas',
    permission: 'tables.read',
  },
  {
    destination: '/quick-sales' as Href,
    icon: 'quickSale',
    key: 'quick-sales',
    label: 'Venda rápida',
    permission: 'quick-sales.read',
  },
  {
    destination: '/credits' as Href,
    icon: 'credits',
    key: 'credits',
    label: 'Fiados',
    permission: 'credits.read',
  },
  {
    destination: '/admin' as Href,
    icon: 'admin',
    key: 'admin',
    label: 'Administrativo',
  },
];

export function AppBottomNavigation({
  activeItem,
}: {
  activeItem: AppNavigationItem;
}) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.footer}>
      <View accessibilityLabel="Navegação principal" style={styles.bar}>
        {navigationItems
          .filter((item) => {
            if (item.permission) {
              return hasPermission(user, item.permission);
            }
            if (item.key === 'admin') {
              return (
                hasPermission(user, 'products.write') ||
                hasPermission(user, 'inventory.read') ||
                hasPermission(user, 'statements.read') ||
                hasPermission(user, 'users.manage') || hasPermission(user, 'roles.manage')
              );
            }
            return true;
          })
          .map((item) => (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeItem === item.key }}
            key={item.key}
            onPress={() => {
              router.replace(item.destination);
            }}
            style={({ pressed }) => [
              styles.item,
              activeItem === item.key && styles.activeItem,
              item.key === 'quick-sales' && styles.centralItem,
              activeItem === item.key &&
                item.key === 'quick-sales' &&
                styles.activeCentralItem,
              pressed && styles.itemPressed,
            ]}
          >
            <View
              style={[
                styles.iconShell,
                item.key === 'quick-sales' && styles.centralIcon,
              ]}
              testID={`bottom-nav-icon-${item.key}`}
            >
              <AppIcon
                color={
                  item.key === 'quick-sales'
                    ? themeColors.primary
                    : activeItem === item.key
                      ? themeColors.primary
                      : themeColors.foregroundMuted
                }
                name={item.icon}
                size={item.key === 'quick-sales' ? 23 : 20}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                activeItem === item.key && styles.activeLabel,
                item.key === 'quick-sales' && styles.centralLabel,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: themeColors.surfaceAccent,
    flexDirection: 'row',
    minHeight: 68,
    maxWidth: 430,
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: themeColors.surfaceAccent,
    borderTopColor: themeColors.divider,
    borderTopWidth: 1,
    paddingBottom: themeSpacing.base,
    paddingHorizontal: themeSpacing.xs,
    paddingTop: 0,
  },
  item: {
    alignItems: 'center',
    borderRadius: themeRadii.compact,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 0,
    paddingHorizontal: themeSpacing.base,
  },
  activeItem: {
    borderTopColor: themeColors.primary,
    borderTopWidth: 3,
  },
  itemPressed: {
    opacity: 0.72,
  },
  centralItem: {
    marginTop: -14,
  },
  activeCentralItem: {
    borderTopWidth: 0,
  },
  centralIcon: {
    backgroundColor: themeColors.accent,
    borderRadius: themeRadii.pill,
    elevation: 3,
    height: 48,
    shadowColor: themeColors.primary,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 48,
  },
  iconShell: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  label: {
    color: themeColors.foregroundMuted,
    fontFamily: themeTypography.auxiliary.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
  activeLabel: {
    color: themeColors.primary,
  },
  centralLabel: {
    color: themeColors.primary,
  },
});
