import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { OperationalText as Text } from '../theme/operational-typography';

import type {
  PaymentAllocationInput,
  PaymentMethod,
} from '../services/comandas-api';
import {
  centsFromBrlInput,
  formatCentsAsBrl,
  formatCentsForBrlInput,
} from '../services/money';
import { themeColors, themeRadii, themeSpacing } from '../theme/tokens';
import { AppIcon, type AppIconName } from './app-icon';

const methods: { label: string; method: PaymentMethod }[] = [
  { label: 'Dinheiro', method: 'CASH' },
  { label: 'Pix', method: 'PIX' },
  { label: 'Cartão de débito', method: 'DEBIT_CARD' },
  { label: 'Cartão de crédito', method: 'CREDIT_CARD' },
];

const methodIcons: Record<PaymentMethod, AppIconName> = {
  COUNTER: 'store',
  CASH: 'cash', PIX: 'pix', DEBIT_CARD: 'card', CREDIT_CARD: 'card',
};

interface PaymentEntry {
  amountCents: number;
  id: number;
  method: PaymentMethod | null;
}

export interface PaymentSummary {
  payments: PaymentAllocationInput[];
  totalCents: number;
  valid: boolean;
}

export function PaymentForm({
  allowZero,
  disabled = false,
  maxCents,
  onPaymentChange,
  onSubmit,
  submitLabel,
  variant = 'default',
}: {
  allowZero: boolean;
  disabled?: boolean;
  maxCents: number;
  onPaymentChange?: (summary: PaymentSummary) => void;
  onSubmit?: (payments: PaymentAllocationInput[]) => void;
  submitLabel?: string;
  variant?: 'default' | 'checkout';
}) {
  const [entries, setEntries] = useState<PaymentEntry[]>([
    { amountCents: 0, id: 1, method: null },
  ]);
  const [openEntryId, setOpenEntryId] = useState<number | null>(null);
  const summary = useMemo(
    () => summarizePayments(entries, allowZero, maxCents),
    [allowZero, entries, maxCents],
  );
  const remainingCents = maxCents - summary.totalCents;
  const changeCallback = useRef(onPaymentChange);
  useLayoutEffect(() => { changeCallback.current = onPaymentChange; }, [onPaymentChange]);
  useEffect(() => { changeCallback.current?.(summary); }, [summary]);
  const canAddPayment =
    summary.totalCents > 0 &&
    remainingCents > 0 &&
    summary.valid &&
    entries.length < methods.length;

  const updateEntries = (next: PaymentEntry[]) => {
    setEntries(next);
  };

  return (
    <View style={styles.container}>
      {entries.map((entry, index) => {
        const selectedByAnotherEntry = new Set(
          entries
            .filter((candidate) => candidate.id !== entry.id)
            .flatMap((candidate) => (candidate.method ? [candidate.method] : [])),
        );
        const availableCents = Math.max(maxCents - entries.reduce(
          (total, candidate) => candidate.id === entry.id ? total : total + candidate.amountCents, 0,
        ), 0);
        const updateAmount = (amountCents: number) => updateEntries(entries.map((candidate) =>
          candidate.id === entry.id ? { ...candidate, amountCents: Math.min(amountCents, availableCents) } : candidate,
        ));

        return (
          <View key={entry.id} style={[styles.paymentCard, variant === 'checkout' && styles.checkoutCard]}>
            <View style={styles.paymentHeading}>
              <Text style={styles.label}>Pagamento {index + 1}</Text>
              {index > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover pagamento ${index + 1}`}
                  disabled={disabled}
                  style={styles.removeButton}
                  onPress={() => {
                    if (openEntryId === entry.id) {
                      setOpenEntryId(null);
                    }
                    updateEntries(entries.filter(({ id }) => id !== entry.id));
                  }}
                >
                  <Text style={styles.removeText}>Remover</Text>
                </Pressable>
              )}
            </View>

            {variant === 'checkout' ? (
              <>
                <Text style={styles.label}>Forma de pagamento</Text>
                <View style={styles.methodGrid}>
                  {methods.map(({ label, method }) => {
                    const selected = entry.method === method;
                    const unavailable = disabled || selectedByAnotherEntry.has(method);
                    return (
                      <Pressable key={method} accessibilityRole="button"
                        accessibilityLabel={`Selecionar ${label} no pagamento ${index + 1}`}
                        accessibilityState={{ disabled: unavailable, selected }} disabled={unavailable}
                        onPress={() => updateEntries(entries.map((candidate) => candidate.id === entry.id ? { ...candidate, method } : candidate))}
                        style={({ pressed }) => [styles.methodTile, selected && styles.methodTileSelected,
                          unavailable && styles.buttonDisabled, pressed && !unavailable && styles.buttonPressed]}>
                        <View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
                          <AppIcon name={methodIcons[method]} size={18} color={themeColors.primary} />
                        </View>
                        <Text style={[styles.methodLabel, selected && styles.buttonText]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
            <Text style={styles.methodPrompt}>Forma de pagamento</Text>
            <Pressable
              accessibilityLabel={`Forma de pagamento ${index + 1}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: openEntryId === entry.id }}
              disabled={disabled}
              onPress={() => {
                setOpenEntryId((current) =>
                  current === entry.id ? null : entry.id,
                );
              }}
              style={({ pressed }) => [
                styles.select,
                openEntryId === entry.id && styles.selectOpen,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={entry.method ? styles.selectText : styles.selectPlaceholder}
              >
                {entry.method
                  ? methods.find(({ method }) => method === entry.method)?.label
                  : 'Selecione uma forma'}
              </Text>
              <Text style={styles.selectArrow}>
                {openEntryId === entry.id ? '⌃' : '⌄'}
              </Text>
            </Pressable>

            {openEntryId === entry.id && (
              <View style={styles.optionList}>
                {methods.map(({ label, method }) => {
                  const selected = entry.method === method;
                  const unavailable = selectedByAnotherEntry.has(method);
                  return (
                    <Pressable
                      accessibilityLabel={`Selecionar ${label} no pagamento ${index + 1}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: unavailable, selected }}
                      disabled={disabled || unavailable}
                      key={method}
                      onPress={() => {
                        updateEntries(
                          entries.map((candidate) =>
                            candidate.id === entry.id
                              ? { ...candidate, method }
                              : candidate,
                          ),
                        );
                        setOpenEntryId(null);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        unavailable && styles.optionDisabled,
                        pressed && !unavailable && styles.buttonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                      {selected && <Text style={styles.optionCheck}>✓</Text>}
                    </Pressable>
                  );
                })}
              </View>
            )}
              </>
            )}

            {variant === 'checkout' && <Text style={styles.label}>Valor do pagamento (R$)</Text>}
            <View style={variant === 'checkout' ? styles.inputRow : undefined}>
            <TextInput
              accessibilityLabel={`Valor do pagamento ${index + 1}`}
              editable={!disabled}
              keyboardType="number-pad"
              inputMode="numeric"
              onChangeText={(value) => {
                updateAmount(centsFromBrlInput(value));
              }}
              style={[styles.input, variant === 'checkout' && styles.checkoutInput]}
              value={formatCentsForBrlInput(entry.amountCents)}
            />
              {variant === 'checkout' && <Pressable accessibilityRole="button"
                accessibilityLabel={`Limpar valor do pagamento ${index + 1}`} disabled={disabled}
                style={styles.clearButton} onPress={() => updateAmount(0)}>
                <AppIcon name="close" size={18} color={themeColors.foregroundMuted} />
              </Pressable>}
            </View>
            {variant === 'checkout' && <Pressable accessibilityRole="button"
              accessibilityLabel={`Pagamento total no pagamento ${index + 1}`} disabled={disabled}
              onPress={() => updateAmount(availableCents)}
              style={({ pressed }) => [styles.fillButton, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}>
              <AppIcon name="quickSale" size={20} color={themeColors.primary} />
              <View style={styles.fillCopy}>
                <Text style={styles.fillTitle}>Pagamento total · {formatCentsAsBrl(availableCents)}</Text>
                <Text style={styles.fillDescription}>Preenche o saldo disponível sem confirmar</Text>
              </View>
            </Pressable>}
          </View>
        );
      })}

      {canAddPayment && (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => {
            const nextId = Math.max(...entries.map(({ id }) => id)) + 1;
            updateEntries([
              ...entries,
              { amountCents: 0, id: nextId, method: null },
            ]);
          }}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.addButtonText}>＋ Adicionar outra forma</Text>
        </Pressable>
      )}

      {variant === 'default' && <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Pago: {formatCentsAsBrl(summary.totalCents)}
        </Text>
        <Text style={styles.summaryText}>
          Restante: {formatCentsAsBrl(Math.max(remainingCents, 0))}
        </Text>
      </View>}

      {onSubmit && submitLabel && (
        <Pressable
          accessibilityRole="button"
          disabled={disabled || !summary.valid}
          onPress={() => {
            onSubmit(summary.payments);
          }}
          style={({ pressed }) => [
            styles.button,
            (disabled || !summary.valid) && styles.buttonDisabled,
            pressed && summary.valid && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{submitLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function summarizePayments(
  entries: PaymentEntry[],
  allowZero: boolean,
  maxCents: number,
): PaymentSummary {
  const totalCents = entries.reduce(
    (total, entry) => total + entry.amountCents,
    0,
  );
  const payments = entries.flatMap((entry) =>
    entry.amountCents > 0 && entry.method
      ? [{ amountCents: entry.amountCents, method: entry.method }]
      : [],
  );
  const everyInformedValueHasMethod = entries.every(
    (entry) => entry.amountCents === 0 || entry.method !== null,
  );

  return {
    payments,
    totalCents,
    valid:
      totalCents <= maxCents &&
      (allowZero || totalCents > 0) &&
      everyInformedValueHasMethod,
  };
}

const styles = StyleSheet.create({
  checkoutCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: themeRadii.operationalCard,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  checkoutInput: {
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.primary,
    borderWidth: 2,
    color: themeColors.primary,
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    minHeight: 52,
    paddingRight: 48,
  },
  clearButton: { alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 4, minHeight: 44, width: 44 },
  fillButton: {
    alignItems: 'center', backgroundColor: themeColors.surfaceAccent, borderColor: themeColors.accent,
    borderRadius: themeRadii.operationalControl, borderWidth: 2, flexDirection: 'row', gap: 10, minHeight: 58, padding: 12,
  },
  fillCopy: { flex: 1, gap: 3 },
  fillDescription: { color: themeColors.foregroundMuted, fontSize: 11, lineHeight: 16 },
  fillTitle: { color: themeColors.primary, fontSize: 14, fontWeight: '700' },
  inputRow: { justifyContent: 'center', flexDirection: 'row' },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodIcon: { alignItems: 'center', backgroundColor: themeColors.surfaceAccent, borderRadius: 8, height: 32, justifyContent: 'center', width: 32 },
  methodIconSelected: { backgroundColor: themeColors.surface },
  methodLabel: { color: themeColors.foreground, flex: 1, fontSize: 13, fontWeight: '700' },
  methodTile: {
    alignItems: 'center', borderColor: themeColors.border, borderRadius: themeRadii.operationalControl,
    borderWidth: 1, flexDirection: 'row', flexGrow: 1, flexBasis: '47%', gap: 8, minHeight: 62, padding: 10,
  },
  methodTileSelected: { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
  removeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  addButton: {
    alignItems: 'center',
    borderColor: themeColors.primary,
    borderRadius: themeRadii.operationalControl,
    borderWidth: 1,
    minHeight: 46,
    padding: 12,
  },
  addButtonText: { color: themeColors.primary, fontWeight: '700' },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: themeRadii.operationalControl,
    minHeight: 48,
    padding: 14,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: themeColors.foregroundOnPrimary, fontWeight: '700' },
  container: { gap: themeSpacing.sm },
  input: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: themeRadii.operationalControl,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 17,
    padding: 12,
  },
  label: { color: themeColors.foreground, fontWeight: '700' },
  methodPrompt: { color: themeColors.foregroundBody, fontSize: 13 },
  option: {
    alignItems: 'center',
    borderBottomColor: themeColors.borderStrong,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionCheck: { color: themeColors.primary, fontSize: 16, fontWeight: '800' },
  optionDisabled: { opacity: 0.35 },
  optionList: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: themeRadii.operationalControl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionSelected: { backgroundColor: themeColors.surfaceMuted },
  optionText: { color: themeColors.foregroundBody, fontWeight: '600' },
  optionTextSelected: { color: themeColors.primary, fontWeight: '800' },
  paymentCard: {
    borderBottomColor: themeColors.divider,
    borderBottomWidth: 1,
    gap: 9,
    paddingBottom: themeSpacing.sm,
  },
  paymentHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  removeText: { color: themeColors.dangerText, fontWeight: '700' },
  select: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: themeRadii.operationalControl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 13,
  },
  selectArrow: { color: themeColors.foregroundBody, fontSize: 18 },
  selectOpen: {
    borderColor: themeColors.primary,
  },
  selectPlaceholder: { color: themeColors.foregroundBody },
  selectText: { color: themeColors.foreground, fontWeight: '700' },
  summary: {
    backgroundColor: themeColors.surfaceMuted,
    borderColor: themeColors.divider,
    borderRadius: themeRadii.operationalControl,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  summaryText: { color: themeColors.foregroundBody, fontWeight: '600' },
});
