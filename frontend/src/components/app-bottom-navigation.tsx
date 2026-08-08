import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { themeColors } from '../theme/tokens';
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
              pressed && styles.itemPressed,
            ]}
          >
            <AppIcon
              color={themeColors.foregroundOnPrimary}
              name={item.icon}
              size={22}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: themeColors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    height: 44,
    maxWidth: 265,
    overflow: 'hidden',
    width: '76%',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: themeColors.background,
    paddingBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  itemPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
