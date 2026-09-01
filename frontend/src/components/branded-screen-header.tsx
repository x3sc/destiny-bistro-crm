import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import {
  themeColors,
  themeSpacing,
  themeTypography,
} from '../theme/tokens';
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
    <View style={styles.hero} testID="branded-screen-header">
      <StatusBar style="light" />
      <View style={styles.content}>
        {onBack ? (
          <ScreenBackButton tone="light" onPress={onBack} />
        ) : (
          <View style={styles.sideSpacer} />
        )}
        <View style={styles.copy}>
          {title !== 'Destiny Bistro CRM' ? (
            <Text style={styles.brand}>Destiny Bistro CRM</Text>
          ) : null}
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            style={styles.title}
          >
            {title}
          </Text>
          {description ? (
            <Text numberOfLines={2} style={styles.description}>
              {description}
            </Text>
          ) : null}
        </View>
        <View style={styles.sideSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: themeColors.foregroundOnPrimary,
    fontFamily: themeTypography.auxiliary.fontFamily,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  content: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: themeSpacing.sm,
    maxWidth: 1180,
    minHeight: 56,
    paddingHorizontal: themeSpacing.mobileMargin,
    paddingVertical: 6,
    width: '100%',
  },
  copy: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  description: {
    color: themeColors.foregroundOnPrimary,
    fontFamily: themeTypography.auxiliary.fontFamily,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 13,
    textAlign: 'center',
  },
  hero: {
    backgroundColor: themeColors.primary,
    borderBottomColor: themeColors.accent,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  sideSpacer: {
    width: themeSpacing.touchTargetMin,
  },
  title: {
    color: themeColors.foregroundOnPrimary,
    ...themeTypography.sectionTitle,
  },
});
