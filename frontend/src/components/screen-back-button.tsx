import { Pressable, StyleSheet, Text } from 'react-native';

import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';

export function ScreenBackButton({
  label = false,
  onPress,
  tone = 'default',
}: {
  label?: boolean;
  onPress: () => void;
  tone?: 'default' | 'light';
}) {
  const light = tone === 'light';

  return (
    <Pressable
      accessibilityLabel="Voltar"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        light && styles.lightButton,
        label && styles.labeledButton,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        color={light ? themeColors.foregroundOnPrimary : themeColors.titleIcon}
        name="back"
        size={22}
      />
      {label ? (
        <Text style={[styles.label, light && styles.lightLabel]}>Voltar</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  label: {
    color: themeColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  labeledButton: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 0,
    width: 'auto',
  },
  lightButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  lightLabel: {
    color: themeColors.foregroundOnPrimary,
  },
  pressed: { opacity: 0.7 },
});
