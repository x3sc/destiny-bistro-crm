import { Pressable, Text } from 'react-native';

import { creditStyles } from './credit-screens.styles';

export function CreditButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        creditStyles.button,
        tone === 'danger' && creditStyles.buttonDanger,
        tone === 'secondary' && creditStyles.buttonSecondary,
        disabled && creditStyles.buttonDisabled,
        pressed && !disabled && creditStyles.buttonPressed,
      ]}
    >
      <Text
        style={[
          creditStyles.buttonText,
          tone === 'danger' && creditStyles.buttonDangerText,
          tone === 'secondary' && creditStyles.buttonSecondaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
