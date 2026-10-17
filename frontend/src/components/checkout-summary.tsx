import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Comanda, PaymentAllocationInput, PaymentMethod } from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors, themeRadii } from '../theme/tokens';
import { AppIcon } from './app-icon';

const methodLabels: Record<PaymentMethod, string> = {
  COUNTER: 'Balcão (caixa externo)',
  CASH: 'Dinheiro', PIX: 'Pix', DEBIT_CARD: 'Cartão de débito', CREDIT_CARD: 'Cartão de crédito',
};

export function CheckoutTotal({ comanda }: { comanda: Comanda }) {
  const count = comanda.items.reduce((total, item) => total + item.confirmedQuantity, 0);
  return (
    <View style={styles.card}>
      <View style={styles.totalHeading}>
        <View style={styles.totalCopy}>
          <Text style={styles.meta}>Total da comanda</Text>
          <Text fontRole="heading" style={styles.total}>{formatCentsAsBrl(comanda.totalCents)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{comanda.status === 'OPEN' ? 'Aguardando pagamento' : 'Comanda encerrada'}</Text>
        </View>
      </View>
      <View style={styles.totalDetails}>
        <AppIcon name="receipt" size={16} color={themeColors.primary} />
        <Text style={styles.meta}>{count} {count === 1 ? 'item confirmado' : 'itens confirmados'}</Text>
      </View>
    </View>
  );
}

export function CheckoutSummary({ comanda, paidCents, payments, valid }: {
  comanda: Comanda;
  paidCents: number;
  payments: PaymentAllocationInput[];
  valid: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const remainingCents = Math.max(comanda.totalCents - paidCents, 0);
  const ready = valid && remainingCents === 0;
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resumo do pagamento</Text>
        <View style={styles.row}>
          <Text style={styles.meta}>Total da comanda:</Text>
          <Text style={styles.value}>{formatCentsAsBrl(comanda.totalCents)}</Text>
        </View>
        {payments.map((payment) => (
          <View key={payment.method} style={styles.row}>
            <Text style={styles.meta}>Informado · {methodLabels[payment.method]}</Text>
            <Text style={styles.value}>{formatCentsAsBrl(payment.amountCents)}</Text>
          </View>
        ))}
        <View style={styles.balance}>
          <Text style={styles.sectionTitle}>Restante: {formatCentsAsBrl(remainingCents)}</Text>
        </View>
        <View accessibilityLiveRegion="polite" style={[styles.notice, ready && styles.readyNotice]}>
          {ready && <AppIcon name="check" size={20} color={themeColors.statusFreeText} />}
          <View style={styles.noticeCopy}>
            <Text style={[styles.noticeTitle, ready && styles.readyText]}>
              {!valid ? 'Selecione a forma dos valores informados' : ready ? 'Valores prontos para confirmar' : 'Pagamento ainda não confirmado'}
            </Text>
            <Text style={[styles.meta, ready && styles.readyText]}>Os valores só serão registrados ao confirmar o fechamento.</Text>
          </View>
        </View>
      </View>
      <View style={styles.itemsCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
          accessibilityLabel={`Itens da comanda (${comanda.items.length} lançamentos)`}
          onPress={() => setExpanded((current) => !current)} style={({ pressed }) => [styles.itemsHeading, pressed && styles.pressed]}>
          <AppIcon name="receipt" size={18} color={themeColors.primary} />
          <Text style={styles.itemsTitle}>Itens da comanda ({comanda.items.length})</Text>
          <AppIcon name={expanded ? 'expand' : 'next'} size={16} color={themeColors.primary} />
        </Pressable>
        {expanded && <View style={styles.itemsContent}>
          {comanda.items.length === 0 && <Text style={styles.meta}>Nenhum item na comanda.</Text>}
          {comanda.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemCopy}>
                <Text style={styles.value}>{item.productName}</Text>
                <Text style={styles.meta}>{item.quantity} unidades · {item.confirmedQuantity} confirmadas</Text>
                {item.configurations?.map((configuration) => configuration.additionals.length > 0 && (
                  <Text key={configuration.id} style={styles.meta}>
                    {configuration.quantity}× com {configuration.additionals.map((additional) => `${additional.quantityPerUnit}× ${additional.additionalName}`).join(', ')}
                  </Text>
                ))}
              </View>
              <Text style={styles.value}>{formatCentsAsBrl(item.subtotalCents)}</Text>
            </View>
          ))}
        </View>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: themeColors.statusAwaitingSurface, borderColor: themeColors.statusAwaitingBorder, borderRadius: themeRadii.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  badgeText: { color: themeColors.statusAwaitingText, fontSize: 11, fontWeight: '700' },
  balance: { borderTopColor: themeColors.divider, borderTopWidth: 1, paddingTop: 12 },
  card: { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border, borderRadius: themeRadii.operationalCard, borderWidth: 1, gap: 12, padding: 16 },
  item: { alignItems: 'flex-start', borderBottomColor: themeColors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 },
  itemCopy: { flex: 1, gap: 4 },
  itemsCard: { borderColor: themeColors.border, borderRadius: themeRadii.operationalCard, borderWidth: 1, overflow: 'hidden' },
  itemsContent: { paddingHorizontal: 14, paddingBottom: 12 },
  itemsHeading: { alignItems: 'center', backgroundColor: themeColors.surfaceAccent, flexDirection: 'row', gap: 10, minHeight: 52, padding: 14 },
  itemsTitle: { color: themeColors.primary, flex: 1, fontSize: 14, fontWeight: '700' },
  meta: { color: themeColors.foregroundMuted, fontSize: 12, lineHeight: 18 },
  notice: { alignItems: 'center', backgroundColor: themeColors.surfaceAccent, borderRadius: themeRadii.operationalControl, flexDirection: 'row', gap: 10, padding: 12 },
  noticeCopy: { flex: 1, gap: 4 },
  noticeTitle: { color: themeColors.foreground, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  readyNotice: { backgroundColor: themeColors.statusFreeSurface, borderColor: themeColors.statusFreeBorder, borderWidth: 1 },
  readyText: { color: themeColors.statusFreeText },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  sectionTitle: { color: themeColors.primary, fontSize: 15, fontWeight: '700' },
  total: { color: themeColors.primary, fontSize: 32, fontWeight: '800', lineHeight: 40 },
  totalCopy: { gap: 4 },
  totalDetails: { alignItems: 'center', borderTopColor: themeColors.divider, borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingTop: 10 },
  totalHeading: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  value: { color: themeColors.foreground, fontSize: 13, fontWeight: '700' },
});
