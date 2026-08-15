import { Pressable, Text, TextInput, View } from 'react-native';

import type { PaymentMethod } from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import {
  brazilianMobileDigits,
  formatBrazilianMobile,
} from '../services/phone';
import { themeColors } from '../theme/tokens';
import { deliveryStyles } from './delivery-screens.styles';

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Crédito',
  DEBIT_CARD: 'Débito',
  PIX: 'Pix',
};

export const paymentMethodOrder: PaymentMethod[] = [
  'CASH',
  'PIX',
  'DEBIT_CARD',
  'CREDIT_CARD',
];

export function DeliveryButton({
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
        deliveryStyles.button,
        tone === 'danger' && deliveryStyles.buttonDanger,
        tone === 'secondary' && deliveryStyles.buttonSecondary,
        disabled && deliveryStyles.buttonDisabled,
        pressed && !disabled && deliveryStyles.buttonPressed,
      ]}
    >
      <Text
        style={[
          deliveryStyles.buttonText,
          tone === 'secondary' && deliveryStyles.buttonSecondaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MoneyField({
  label,
  onChangeCents,
  valueCents,
}: {
  label: string;
  onChangeCents: (value: number) => void;
  valueCents: number;
}) {
  return (
    <View style={deliveryStyles.fieldGroup}>
      <Text style={deliveryStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="numeric"
        onChangeText={(text) => {
          onChangeCents(centsFromInput(text));
        }}
        placeholderTextColor={themeColors.placeholder}
        style={deliveryStyles.field}
        value={inputFromCents(valueCents)}
      />
    </View>
  );
}

export function TextField({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={deliveryStyles.fieldGroup}>
      <Text style={deliveryStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.placeholder}
        style={deliveryStyles.field}
        value={value}
      />
    </View>
  );
}

export function PhoneField({
  label,
  onChangeDigits,
  valueDigits,
}: {
  label: string;
  onChangeDigits: (value: string) => void;
  valueDigits: string;
}) {
  return (
    <View style={deliveryStyles.fieldGroup}>
      <Text style={deliveryStyles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="phone-pad"
        maxLength={15}
        onChangeText={(value) => onChangeDigits(brazilianMobileDigits(value))}
        placeholder="(11) 99999-9999"
        placeholderTextColor={themeColors.placeholder}
        style={deliveryStyles.field}
        value={formatBrazilianMobile(valueDigits)}
      />
    </View>
  );
}

export function PaymentMethodPicker({
  onSelect,
  selected,
}: {
  onSelect: (method: PaymentMethod) => void;
  selected: PaymentMethod;
}) {
  return (
    <View style={deliveryStyles.fieldGroup}>
      <Text style={deliveryStyles.fieldLabel}>Forma de pagamento</Text>
      <View style={deliveryStyles.methodRow}>
        {paymentMethodOrder.map((method) => (
          <Pressable
            accessibilityLabel={paymentMethodLabels[method]}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === method }}
            key={method}
            onPress={() => {
              onSelect(method);
            }}
            style={({ pressed }) => [
              deliveryStyles.methodOption,
              selected === method && deliveryStyles.methodOptionSelected,
              pressed && deliveryStyles.cardPressed,
            ]}
          >
            <Text
              style={[
                deliveryStyles.methodOptionText,
                selected === method && deliveryStyles.methodOptionTextSelected,
              ]}
            >
              {paymentMethodLabels[method]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TotalRow({
  emphasis = false,
  label,
  negative = false,
  valueCents,
}: {
  emphasis?: boolean;
  label: string;
  negative?: boolean;
  valueCents: number;
}) {
  return (
    <View style={deliveryStyles.row}>
      <Text
        style={[
          deliveryStyles.totalLabel,
          emphasis && deliveryStyles.totalLabelEmphasis,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          deliveryStyles.totalValue,
          emphasis && deliveryStyles.totalValueEmphasis,
          negative && deliveryStyles.totalValueNegative,
        ]}
      >
        {`${negative ? '- ' : ''}${formatCentsAsBrl(Math.abs(valueCents))}`}
      </Text>
    </View>
  );
}

export function centsFromInput(value: string) {
  const digits = value.replace(/\D/gu, '').slice(-9);
  return digits ? Number(digits) : 0;
}

export function inputFromCents(value: number) {
  const integerPart = Math.floor(value / 100).toLocaleString('pt-BR');
  const decimalPart = String(value % 100).padStart(2, '0');
  return `R$ ${integerPart},${decimalPart}`;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  });
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  });
}
