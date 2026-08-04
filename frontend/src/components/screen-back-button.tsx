import { Pressable, StyleSheet, Text } from 'react-native';

import { themeColors } from '../theme/tokens';

export function ScreenBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Voltar"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>‹</Text>
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
  icon: {
    color: themeColors.titleIcon,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },
  pressed: { opacity: 0.7 },
});
