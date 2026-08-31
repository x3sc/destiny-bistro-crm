import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  themeColors,
  themeRadii,
  themeSpacing,
  themeTypography,
} from '../theme/tokens';
import { AppIcon, type AppIconName } from './app-icon';

export type AppNavigationItem = 'admin' | 'credits' | 'tables';

const navigationItems: {
  destination: Href;
  icon: AppIconName;
  key: AppNavigationItem;
  label: string;
}[] = [
  { destination: '/tables' as Href, icon: 'tables', key: 'tables', label: 'Mesas' },
  { destination: '/credits' as Href, icon: 'credits', key: 'credits', label: 'Fiados' },
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

  return (
    <View style={styles.footer}>
      <View accessibilityLabel="Navegação principal" style={styles.bar}>
        {navigationItems.map((item) => (
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
              pressed && styles.itemPressed,
            ]}
          >
            <AppIcon
              color={
                activeItem === item.key
                  ? themeColors.primary
                  : themeColors.foregroundMuted
              }
              name={item.icon}
              size={21}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                activeItem === item.key && styles.activeLabel,
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
    backgroundColor: themeColors.background,
    flexDirection: 'row',
    minHeight: 64,
    maxWidth: 430,
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: themeColors.background,
    borderTopColor: themeColors.divider,
    borderTopWidth: 1,
    paddingBottom: themeSpacing.base,
    paddingHorizontal: themeSpacing.mobileMargin,
    paddingTop: themeSpacing.base,
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
    backgroundColor: themeColors.surfaceAccent,
    borderTopColor: themeColors.accent,
    borderTopWidth: 3,
  },
  itemPressed: {
    opacity: 0.72,
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
});
