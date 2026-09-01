import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type {
  PaymentAllocationInput,
  PaymentMethod,
} from '../services/comandas-api';
import {
  centsFromBrlInput,
  formatCentsAsBrl,
  formatCentsForBrlInput,
} from '../services/money';
import { themeColors } from '../theme/tokens';

const methods: { label: string; method: PaymentMethod }[] = [
  { label: 'Dinheiro', method: 'CASH' },
  { label: 'Pix', method: 'PIX' },
  { label: 'Cartão de débito', method: 'DEBIT_CARD' },
  { label: 'Cartão de crédito', method: 'CREDIT_CARD' },
];

interface PaymentEntry {
  amountCents: number;
  id: number;
  method: PaymentMethod | null;
}

interface PaymentSummary {
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
}: {
  allowZero: boolean;
  disabled?: boolean;
  maxCents: number;
  onPaymentChange?: (summary: PaymentSummary) => void;
  onSubmit?: (payments: PaymentAllocationInput[]) => void;
  submitLabel?: string;
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
  const canAddPayment =
    summary.totalCents > 0 &&
    remainingCents > 0 &&
    summary.valid &&
    entries.length < methods.length;

  const updateEntries = (next: PaymentEntry[]) => {
    setEntries(next);
    onPaymentChange?.(summarizePayments(next, allowZero, maxCents));
  };

  return (
    <View style={styles.container}>
      {entries.map((entry, index) => {
        const selectedByAnotherEntry = new Set(
          entries
            .filter((candidate) => candidate.id !== entry.id)
            .flatMap((candidate) => (candidate.method ? [candidate.method] : [])),
        );

        return (
          <View key={entry.id} style={styles.paymentCard}>
            <View style={styles.paymentHeading}>
              <Text style={styles.label}>Pagamento {index + 1}</Text>
              {index > 0 && (
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
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

            <TextInput
              accessibilityLabel={`Valor do pagamento ${index + 1}`}
              editable={!disabled}
              keyboardType="number-pad"
              onChangeText={(value) => {
                const allocatedByOtherPayments = entries.reduce(
                  (total, candidate) =>
                    candidate.id === entry.id
                      ? total
                      : total + candidate.amountCents,
                  0,
                );
                const availableCents = Math.max(
                  maxCents - allocatedByOtherPayments,
                  0,
                );
                const amountCents = Math.min(
                  centsFromBrlInput(value),
                  availableCents,
                );
                updateEntries(
                  entries.map((candidate) =>
                    candidate.id === entry.id
                      ? { ...candidate, amountCents }
                      : candidate,
                  ),
                );
              }}
              style={styles.input}
              value={formatCentsForBrlInput(entry.amountCents)}
            />
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

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Pago: {formatCentsAsBrl(summary.totalCents)}
        </Text>
        <Text style={styles.summaryText}>
          Restante: {formatCentsAsBrl(Math.max(remainingCents, 0))}
        </Text>
      </View>

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
  addButton: {
    alignItems: 'center',
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 46,
    padding: 12,
  },
  addButtonText: { color: themeColors.primary, fontWeight: '700' },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 22,
    minHeight: 48,
    padding: 14,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: themeColors.foregroundOnPrimary, fontWeight: '700' },
  container: { gap: 12 },
  input: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: 22,
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
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionSelected: { backgroundColor: themeColors.surfaceMuted },
  optionText: { color: themeColors.foregroundBody, fontWeight: '600' },
  optionTextSelected: { color: themeColors.primary, fontWeight: '800' },
  paymentCard: { gap: 9 },
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
    borderRadius: 22,
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
    borderRadius: 22,
    gap: 5,
    padding: 14,
  },
  summaryText: { color: themeColors.foregroundBody, fontWeight: '600' },
});
