import { Alert, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { type Comanda, type ComandaItem, type ComandaItemConfiguration } from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import { styles } from './comanda-details-screen.styles';

export const statusLabels: Record<Comanda['status'], string> = {
  CANCELLED: 'Cancelada',
  CLOSED: 'Fechada',
  OPEN: 'Aberta',
};

const paymentMethodLabels = {
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'Pix',
} as const;

export function Message({
  text,
  tone = 'error',
}: {
  text: string;
  tone?: 'error' | 'notice';
}) {
  return <Text style={tone === 'notice' ? styles.notice : styles.error}>{text}</Text>;
}

export function ComandaItems({
  comanda,
  disabled,
  onChangeQuantity,
  onConfirmItem,
  onConfigureAdditionals,
  onCancelConfiguration,
  onRemoveItem,
}: {
  comanda: Comanda;
  disabled: boolean;
  onChangeQuantity: (item: ComandaItem, delta: 1 | -1) => void;
  onConfirmItem: (item: ComandaItem) => void;
  onConfigureAdditionals: (item: ComandaItem) => void;
  onCancelConfiguration?: (item: ComandaItem, configuration: ComandaItemConfiguration) => void;
  onRemoveItem: (item: ComandaItem) => void;
}) {
  const newItems = comanda.items.filter(
    (item) => item.quantity > item.confirmedQuantity,
  );
  const confirmedItems = comanda.items.filter((item) => item.confirmedQuantity > 0);
  const newSubtotalCents = newItems.reduce(
    (total, item) =>
      total +
      (item.quantity - item.confirmedQuantity) * item.unitPriceCents +
      configurationAdditionalTotal(item, 'pending'),
    0,
  );
  const confirmedSubtotalCents = confirmedItems.reduce(
    (total, item) =>
      total +
      item.confirmedQuantity * item.unitPriceCents +
      configurationAdditionalTotal(item, 'confirmed'),
    0,
  );
  const totalQuantity = comanda.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <View style={styles.itemsContainer}>
      {comanda.items.length === 0 && (
        <View style={[styles.card, styles.emptyState]}>
          <Text style={styles.emptyStateTitle}>Nenhum item lançado ainda</Text>
          <Text style={styles.description}>
            Use a ação abaixo para adicionar o primeiro produto.
          </Text>
        </View>
      )}

      {comanda.items.length > 0 && (
        <>
          <View style={styles.openItemsSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Itens em aberto</Text>
              <Text style={styles.sectionDescription}>
                Editáveis até a confirmação da entrega.
              </Text>
            </View>
            {newItems.length === 0 && (
              <Text style={styles.emptySectionText}>Nenhum item em aberto.</Text>
            )}
            {newItems.map((item) => {
              const newQuantity = item.quantity - item.confirmedQuantity;

              return (
                <View key={`${item.id}-new`} style={styles.itemRow}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                  </View>
                  <Text style={styles.itemUnitPrice}>
                    {formatCentsAsBrl(item.unitPriceCents)} por unidade
                  </Text>
                  <Text style={styles.description}>
                    {newQuantity} x {formatCentsAsBrl(item.unitPriceCents)} ={' '}
                    {formatCentsAsBrl(newQuantity * item.unitPriceCents)}
                  </Text>
                  <ConfigurationDetails item={item} mode="pending" />
                  <Text style={styles.itemTimestamp}>
                    Adicionado em: {formatItemDateTime(item.createdAt)}
                  </Text>
                  <QuantityControls
                    disabled={disabled}
                    item={item}
                    onChangeQuantity={onChangeQuantity}
                    onConfirmItem={onConfirmItem}
                    onConfigureAdditionals={onConfigureAdditionals}
                    onRemoveItem={onRemoveItem}
                  />
                </View>
              );
            })}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal em aberto</Text>
              <Text style={styles.subtotalValue}>
                {formatCentsAsBrl(newSubtotalCents)}
              </Text>
            </View>
          </View>

          <View style={styles.confirmedItemsSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Itens confirmados</Text>
              <Text style={styles.sectionDescription}>
                Entregues ao cliente. Não podem mais ser alterados.
              </Text>
            </View>
            {confirmedItems.length === 0 && (
              <Text style={styles.emptySectionText}>Nenhum item confirmado.</Text>
            )}
            {confirmedItems.map((item) => (
              <View key={`${item.id}-confirmed`} style={styles.itemRow}>
                <View style={[styles.itemHeader, styles.confirmedItemHeader]}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.confirmedBadge}>Confirmado</Text>
                </View>
                <Text style={styles.itemUnitPrice}>
                  {formatCentsAsBrl(item.unitPriceCents)} por unidade
                </Text>
                <Text style={styles.description}>
                  {item.confirmedQuantity} x {formatCentsAsBrl(item.unitPriceCents)} ={' '}
                  {formatCentsAsBrl(item.confirmedQuantity * item.unitPriceCents)}
                </Text>
                <ConfigurationDetails
                  item={item}
                  mode="confirmed"
                  onCancelConfiguration={onCancelConfiguration}
                />
                <Text style={styles.itemTimestamp}>
                  Adicionado em: {formatItemDateTime(item.createdAt)}
                </Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal confirmado</Text>
              <Text style={styles.subtotalValue}>
                {formatCentsAsBrl(confirmedSubtotalCents)}
              </Text>
            </View>
          </View>
        </>
      )}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          Total da comanda · {totalQuantity}{' '}
          {totalQuantity === 1 ? 'item' : 'itens'}
        </Text>
        <Text
          accessibilityLabel={`Total ${formatCentsAsBrl(comanda.totalCents)}`}
          style={styles.totalText}
        >
          {formatCentsAsBrl(comanda.totalCents)}
        </Text>
      </View>
      {(comanda.payments.length > 0 || comanda.credit || comanda.status === 'CLOSED') && (
        <View style={styles.confirmedItemsSection}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Pagamentos</Text>
            {comanda.credit && (
              <Text style={styles.sectionDescription}>
                Total {formatCentsAsBrl(comanda.credit.totalCents)} · Pago{' '}
                {formatCentsAsBrl(comanda.credit.paidCents)} · Restante{' '}
                {formatCentsAsBrl(comanda.credit.balanceCents)}
              </Text>
            )}
          </View>
          {comanda.payments.length === 0 ? (
            <Text style={styles.emptySectionText}>
              {comanda.credit ? 'Nenhum pagamento registrado.' : 'Forma de pagamento não informada.'}
            </Text>
          ) : (
            comanda.payments.map((payment) => (
              <View key={payment.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{formatCentsAsBrl(payment.amountCents)}</Text>
                {payment.allocations.map((allocation) => (
                  <Text key={allocation.id} style={styles.description}>
                    {paymentMethodLabels[allocation.method]} ·{' '}
                    {formatCentsAsBrl(allocation.amountCents)}
                  </Text>
                ))}
                {payment.allocations.length === 0 && (
                  <Text style={styles.description}>Forma de pagamento não informada</Text>
                )}
                <Text style={styles.itemTimestamp}>
                  {formatItemDateTime(payment.paidAt)} ·{' '}
                  {payment.recordedBy?.name ?? 'Operador não informado'}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function ConfigurationDetails({
  item,
  mode,
  onCancelConfiguration,
}: {
  item: ComandaItem;
  mode: 'confirmed' | 'pending';
  onCancelConfiguration?: (item: ComandaItem, configuration: ComandaItemConfiguration) => void;
}) {
  const configurations = (item.configurations ?? []).filter((configuration) => {
    const quantity =
      mode === 'confirmed'
        ? configuration.confirmedQuantity
        : configuration.quantity - configuration.confirmedQuantity;
    return (
      quantity > 0 &&
      (configuration.additionals.length > 0 ||
        (mode === 'confirmed' && Boolean(onCancelConfiguration)))
    );
  });
  return (
    <>
      {configurations.map((configuration) => {
        const quantity =
          mode === 'confirmed'
            ? configuration.confirmedQuantity
            : configuration.quantity - configuration.confirmedQuantity;
        return (
          <View key={`${configuration.id}-${mode}`}>
            <Text style={styles.description}>
              {quantity} un.{configuration.additionals.length > 0 ? ` com ${configuration.additionals.map((additional) =>
                `${additional.quantityPerUnit}x ${additional.additionalName}`,
              ).join(', ')}` : ' sem adicionais'}
            </Text>
            {mode === 'confirmed' && onCancelConfiguration ? (
              <Pressable
                accessibilityLabel="Cancelar unidades confirmadas"
                accessibilityRole="button"
                onPress={() => onCancelConfiguration(item, configuration)}
                style={styles.cancelConfirmedButton}
              >
                <Text numberOfLines={1} style={styles.cancelConfirmedButtonText}>
                  Cancelar unidades confirmadas
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function configurationAdditionalTotal(
  item: ComandaItem,
  mode: 'confirmed' | 'pending',
) {
  if (!item.configurations) {
    return mode === 'pending' ? item.additionalTotalCents ?? 0 : 0;
  }
  return item.configurations.reduce((total, configuration) => {
    const quantity =
      mode === 'confirmed'
        ? configuration.confirmedQuantity
        : configuration.quantity - configuration.confirmedQuantity;
    const perUnit = configuration.additionals.reduce(
      (sum, additional) =>
        sum + additional.unitPriceCents * additional.quantityPerUnit,
      0,
    );
    return total + quantity * perUnit;
  }, 0);
}

function formatItemDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export function ComandaActions({
  canClose,
  canCreateCredit,
  credit,
  disabled,
  isClosing,
  onAddProducts,
  onCancelCredit,
  onClose,
  onFinalizeCredit,
  readOnly,
  status,
}: {
  canClose: boolean;
  canCreateCredit: boolean;
  credit: Comanda['credit'];
  disabled: boolean;
  isClosing: boolean;
  onAddProducts: () => void;
  onCancelCredit: () => void;
  onClose: () => void;
  onFinalizeCredit: () => void;
  readOnly: boolean;
  status: Comanda['status'];
}) {
  const { width } = useWindowDimensions();
  const stackPrimaryActions = width < 360;

  if (readOnly) {
    return (
      <View style={styles.actions}>
        <Message
          text="Seu cargo permite consultar esta comanda, sem realizar alterações."
          tone="notice"
        />
      </View>
    );
  }

  if (status !== 'OPEN') {
    return null;
  }

  if (credit?.source === 'MANUAL' && credit.status === 'DRAFT') {
    return (
      <View style={styles.actions}>
        <ActionButton
          label="Adicionar produtos"
          onPress={onAddProducts}
          tone="accent"
        />
        {!canCreateCredit && (
          <Message
            text="Adicione produtos e confirme todos os itens antes de finalizar o fiado."
            tone="notice"
          />
        )}
        <ActionButton
          disabled={disabled || !canCreateCredit}
          label={isClosing ? 'Finalizando...' : 'Finalizar fiado'}
          onPress={onFinalizeCredit}
        />
        <ActionButton
          disabled={disabled}
          label="Cancelar rascunho"
          onPress={() => {
            confirmDestructiveAction({
              message: 'Deseja cancelar este rascunho de fiado?',
              onConfirm: onCancelCredit,
              title: 'Cancelar rascunho',
            });
          }}
          tone="danger"
        />
      </View>
    );
  }

  if (credit?.status === 'OPEN') {
    return (
      <View style={styles.actions}>
        <ActionButton
          label="Adicionar produtos"
          onPress={onAddProducts}
          tone="accent"
        />
        <Message
          text={
            canCreateCredit
              ? 'Este fiado está em aberto e pode receber novos itens.'
              : 'Confirme os itens novos antes de quitar este fiado.'
          }
          tone="notice"
        />
      </View>
    );
  }

  return (
    <View style={styles.actions} testID="comanda-primary-actions">
      <View
        style={[
          styles.primaryActionsRow,
          stackPrimaryActions && styles.primaryActionsColumn,
        ]}
      >
        <View
          style={
            stackPrimaryActions
              ? styles.stackedPrimaryAction
              : styles.addProductsAction
          }
        >
          <ActionButton
            accessibilityLabel="Adicionar produtos"
            label="＋  Adicionar produtos"
            onPress={onAddProducts}
            tone="accent"
          />
        </View>
        <View
          style={
            stackPrimaryActions
              ? styles.stackedPrimaryAction
              : styles.closeTableAction
          }
        >
          <ActionButton
            disabled={disabled || !canClose}
            label={isClosing ? 'Fechando...' : 'Fechar mesa'}
            onPress={onClose}
            tone="secondary"
          />
        </View>
      </View>
      {!canClose && (
        <Text style={styles.closeHelper}>
          Confirme todos os itens antes de fechar
        </Text>
      )}
    </View>
  );
}

export function ComandaCancellationAction({
  disabled,
  hasItems,
  onCancel,
}: {
  disabled: boolean;
  hasItems: boolean;
  onCancel: () => void;
}) {
  return (
    <View style={styles.cancellationSection} testID="comanda-cancellation-actions">
      <Text style={styles.sectionTitle}>Ações da comanda</Text>
      <Text style={styles.cancellationDescription}>
        O cancelamento exige confirmação e registro do motivo.
      </Text>
      <ActionButton
        disabled={disabled}
        label={
          disabled
            ? 'Cancelando...'
            : hasItems
              ? 'Cancelar comanda'
              : 'Cancelar comanda vazia'
        }
        onPress={() => {
          confirmDestructiveAction({
            message: hasItems
              ? 'Deseja continuar com o cancelamento desta comanda? O motivo será solicitado em seguida.'
              : 'Deseja cancelar esta comanda vazia e liberar a mesa?',
            onConfirm: onCancel,
            title: 'Cancelar comanda',
          });
        }}
        tone="danger"
      />
    </View>
  );
}

function QuantityControls({
  disabled,
  item,
  onChangeQuantity,
  onConfirmItem,
  onConfigureAdditionals,
  onRemoveItem,
}: {
  disabled: boolean;
  item: ComandaItem;
  onChangeQuantity: (item: ComandaItem, delta: 1 | -1) => void;
  onConfirmItem: (item: ComandaItem) => void;
  onConfigureAdditionals: (item: ComandaItem) => void;
  onRemoveItem: (item: ComandaItem) => void;
}) {
  const minimumQuantity = Math.max(1, item.confirmedQuantity);
  const newQuantity = item.quantity - item.confirmedQuantity;

  return (
    <View style={styles.quantityActions}>
      <Text style={styles.quantityActionsLabel}>Quantidade nova</Text>
      <View style={styles.quantityControls}>
        <SmallButton
          accessibilityLabel={`Remover ${item.productName}`}
          disabled={disabled}
          label="×"
          onPress={() => {
            confirmItemRemoval(item, onRemoveItem);
          }}
          tone="danger"
        />
        <SmallButton
          disabled={disabled || item.quantity <= minimumQuantity}
          label="-"
          onPress={() => {
            onChangeQuantity(item, -1);
          }}
        />
        <Text style={styles.quantityText}>{newQuantity}</Text>
        <SmallButton
          disabled={disabled}
          label="+"
          onPress={() => {
            onChangeQuantity(item, 1);
          }}
        />
      </View>
      <Pressable
        accessibilityLabel={`Adicionais de ${item.productName}`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => onConfigureAdditionals(item)}
        style={({ pressed }) => [
          styles.confirmDeliveryButton,
          styles.additionalButton,
          disabled && styles.disabledButton,
          pressed && !disabled && styles.pressedButton,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.confirmDeliveryButtonText,
            styles.additionalButtonText,
          ]}
        >
          Configurar adicionais
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`Confirmar ${item.productName}`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          onConfirmItem(item);
        }}
        style={({ pressed }) => [
          styles.confirmDeliveryButton,
          disabled && styles.disabledButton,
          pressed && !disabled && styles.pressedButton,
        ]}
      >
        <Text numberOfLines={1} style={styles.confirmDeliveryButtonText}>
          ✓  Confirmar entrega
        </Text>
      </Pressable>
    </View>
  );
}

function confirmItemRemoval(item: ComandaItem, onRemoveItem: (item: ComandaItem) => void) {
  const message =
    item.confirmedQuantity > 0
      ? `Deseja remover os novos lançamentos de ${item.productName}?`
      : `Deseja remover ${item.productName} da comanda?`;

  confirmDestructiveAction({
    message,
    onConfirm: () => {
      onRemoveItem(item);
    },
    title: 'Remover item',
  });
}

function confirmDestructiveAction({
  message,
  onConfirm,
  title,
}: {
  message: string;
  onConfirm: () => void;
  title: string;
}) {
  if (Platform.OS === 'web') {
    const confirm = (globalThis as typeof globalThis & {
      confirm?: (message?: string) => boolean;
    }).confirm;

    if (confirm?.(message)) {
      onConfirm();
    }

    return;
  }

  Alert.alert(title, message, [
    { style: 'cancel', text: 'Cancelar' },
    {
      onPress: () => {
        onConfirm();
      },
      style: 'destructive',
      text: title,
    },
  ]);
}

function SmallButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  tone = 'default',
}: {
  accessibilityLabel?: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'default';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        tone === 'danger' && styles.dangerSmallButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

export function ActionButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'primary' | 'secondary' | 'tertiary';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'accent' && styles.accentButton,
        tone === 'danger' && styles.dangerButton,
        tone === 'secondary' && styles.secondaryButton,
        tone === 'tertiary' && styles.tertiaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === 'accent' && styles.accentButtonText,
          tone === 'danger' && styles.dangerButtonText,
          tone === 'secondary' && styles.secondaryButtonText,
          tone === 'tertiary' && styles.tertiaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
