import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../theme/tokens';
import { ScreenBackButton } from './screen-back-button';

export function BrandedScreenHeader({
  description,
  onBack,
  title,
}: {
  description?: string;
  onBack?: () => void;
  title: string;
}) {
  return (
    <View style={styles.hero}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.topRow}>
          {onBack ? (
            <ScreenBackButton label tone="light" onPress={onBack} />
          ) : (
            <View />
          )}
          <Text style={styles.brand}>Destiny Bistro CRM</Text>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 15,
    fontWeight: '300',
  },
  content: {
    alignSelf: 'center',
    gap: 7,
    maxWidth: 1180,
    paddingBottom: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    width: '100%',
  },
  description: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    maxWidth: 620,
  },
  hero: {
    backgroundColor: themeColors.primary,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
    overflow: 'hidden',
  },
  title: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 42,
    marginTop: 8,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
});
