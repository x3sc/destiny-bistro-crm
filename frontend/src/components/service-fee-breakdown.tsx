import { Pressable, StyleSheet, View } from 'react-native';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors } from '../theme/tokens';
import { formatCentsAsBrl } from '../services/money';
import type { Comanda } from '../services/comandas-api';

export function ServiceFeeBreakdown({ fee }: { fee: NonNullable<Comanda['serviceFee']> }) {
  return <View style={styles.breakdown}>
    <View style={styles.row}><Text>Consumo confirmado</Text><Text>{formatCentsAsBrl(fee.subtotalCents)}</Text></View>
    <View style={styles.row}><Text>{fee.included ? 'Taxa de serviço (10%)' : 'Taxa de serviço dispensada'}</Text><Text>{formatCentsAsBrl(fee.amountCents)}</Text></View>
  </View>;
}
export function ServiceFeeChoice({ included, disabled, onChange }: { included: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel="Incluir taxa de serviço de 10%"
    accessibilityState={{ checked: included, disabled }} aria-checked={included} aria-disabled={disabled}
    disabled={disabled} onPress={() => onChange(!included)} style={[styles.choice, disabled && styles.disabled]}>
    <Text style={styles.check}>{included ? '✓' : '○'}</Text>
    <View style={styles.copy}><Text fontRole="heading" style={styles.label}>Incluir taxa de serviço de 10%</Text>
      <Text style={styles.hint}>Opcional. Desmarque se o cliente dispensar.</Text></View>
  </Pressable>;
}
const styles = StyleSheet.create({ breakdown: { gap: 10, padding: 16, borderColor: themeColors.divider, borderWidth: 1, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  choice: { minHeight: 56, padding: 16, borderRadius: 12, backgroundColor: themeColors.surfaceAccent, flexDirection: 'row', gap: 12, alignItems: 'center' },
  check: { fontSize: 25, color: themeColors.primary }, copy: { flex: 1, gap: 4 },
  label: { color: themeColors.primary, fontWeight: '800', fontSize: 16 }, hint: { color: themeColors.foregroundMuted, lineHeight: 20 }, disabled: { opacity: 0.55 },
});
