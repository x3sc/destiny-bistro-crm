import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { type Comanda, type ComandaItem } from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import { styles } from './comanda-details-screen.styles';

export const statusLabels: Record<Comanda['status'], string> = {
  CANCELLED: 'Cancelada',
  CLOSED: 'Fechada',
  OPEN: 'Aberta',
};

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
  onRemoveItem,
}: {
  comanda: Comanda;
  disabled: boolean;
  onChangeQuantity: (item: ComandaItem, delta: 1 | -1) => void;
  onConfirmItem: (item: ComandaItem) => void;
  onRemoveItem: (item: ComandaItem) => void;
}) {
  const newItems = comanda.items.filter(
    (item) => item.quantity > item.confirmedQuantity,
  );
  const confirmedItems = comanda.items.filter((item) => item.confirmedQuantity > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Itens</Text>
      {comanda.items.length === 0 && (
        <Text style={styles.description}>Nenhum item lançado nesta comanda.</Text>
      )}

      {comanda.items.length > 0 && (
        <>
          <Text style={styles.itemDivisionTitle}>Itens novos</Text>
          {newItems.length === 0 && (
            <Text style={styles.description}>Nenhum item novo.</Text>
          )}
          {newItems.map((item) => {
            const newQuantity = item.quantity - item.confirmedQuantity;

            return (
              <View key={`${item.id}-new`} style={styles.itemRow}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <QuantityControls
                    disabled={disabled}
                    item={item}
                    onChangeQuantity={onChangeQuantity}
                    onConfirmItem={onConfirmItem}
                    onRemoveItem={onRemoveItem}
                  />
                </View>
                <Text style={styles.description}>
                  {newQuantity} x {formatCentsAsBrl(item.unitPriceCents)} ={' '}
                  {formatCentsAsBrl(newQuantity * item.unitPriceCents)}
                </Text>
              </View>
            );
          })}

          <Text style={styles.itemDivisionTitle}>Itens imutáveis</Text>
          {confirmedItems.length === 0 && (
            <Text style={styles.description}>Nenhum item imutável.</Text>
          )}
          {confirmedItems.map((item) => (
            <View key={`${item.id}-confirmed`} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.confirmedBadge}>Confirmado</Text>
              </View>
              <Text style={styles.description}>
                {item.confirmedQuantity} x {formatCentsAsBrl(item.unitPriceCents)} ={' '}
                {formatCentsAsBrl(item.confirmedQuantity * item.unitPriceCents)}
              </Text>
            </View>
          ))}
        </>
      )}
      <Text style={styles.totalText}>Total {formatCentsAsBrl(comanda.totalCents)}</Text>
    </View>
  );
}

export function ComandaActions({
  canCancel,
  canClose,
  disabled,
  isClosing,
  onAddProducts,
  onBack,
  onCancel,
  onClose,
  status,
}: {
  canCancel: boolean;
  canClose: boolean;
  disabled: boolean;
  isClosing: boolean;
  onAddProducts: () => void;
  onBack: () => void;
  onCancel: () => void;
  onClose: () => void;
  status: Comanda['status'];
}) {
  if (status !== 'OPEN') {
    return <ActionButton label="Voltar" onPress={onBack} tone="secondary" />;
  }

  return (
    <View style={styles.actions}>
      <ActionButton label="Adicionar produtos" onPress={onAddProducts} />
      {!canClose && (
        <Message
          text="Confirme todos os itens novos antes de fechar a mesa."
          tone="notice"
        />
      )}
      <ActionButton
        disabled={disabled || !canClose}
        label={isClosing ? 'Fechando...' : 'Fechar mesa'}
        onPress={() => {
          confirmDestructiveAction({
            message:
              'Deseja fechar esta mesa? Os itens confirmados serão preservados no histórico.',
            onConfirm: onClose,
            title: 'Fechar mesa',
          });
        }}
      />
      {!canCancel && (
        <Message
          text="Remova todos os itens antes de cancelar e liberar esta comanda."
          tone="notice"
        />
      )}
      {canCancel && (
        <ActionButton
          disabled={disabled}
          label={disabled ? 'Cancelando...' : 'Cancelar comanda vazia'}
          onPress={() => {
            confirmDestructiveAction({
              message: 'Deseja cancelar esta comanda vazia e liberar a mesa?',
              onConfirm: onCancel,
              title: 'Cancelar comanda',
            });
          }}
          tone="danger"
        />
      )}
      <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
    </View>
  );
}

function QuantityControls({
  disabled,
  item,
  onChangeQuantity,
  onConfirmItem,
  onRemoveItem,
}: {
  disabled: boolean;
  item: ComandaItem;
  onChangeQuantity: (item: ComandaItem, delta: 1 | -1) => void;
  onConfirmItem: (item: ComandaItem) => void;
  onRemoveItem: (item: ComandaItem) => void;
}) {
  const minimumQuantity = Math.max(1, item.confirmedQuantity);
  const newQuantity = item.quantity - item.confirmedQuantity;

  return (
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
      <SmallButton
        accessibilityLabel={`Confirmar ${item.productName}`}
        disabled={disabled}
        label="✓"
        onPress={() => {
          onConfirmItem(item);
        }}
        tone="confirm"
      />
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
  tone?: 'confirm' | 'danger' | 'default';
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        tone === 'confirm' && styles.confirmSmallButton,
        tone === 'danger' && styles.dangerSmallButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function ActionButton({
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
        styles.button,
        tone === 'danger' && styles.dangerButton,
        tone === 'secondary' && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonText, tone === 'secondary' && styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}
