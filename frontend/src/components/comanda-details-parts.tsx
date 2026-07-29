import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { type Comanda, type ComandaItem } from '../services/comandas-api';
import { formatCentsAsBrl } from '../services/money';
import { styles } from './comanda-details-screen.styles';

export const statusLabels: Record<Comanda['status'], string> = {
  CANCELLED: 'Cancelada',
  CLOSED: 'Fechada',
  OPEN: 'Aberta',
};

const eventLabels: Record<Comanda['events'][number]['type'], string> = {
  CANCELLED: 'Comanda cancelada',
  CLOSED: 'Comanda fechada',
  ITEM_ADDED: 'Produto adicionado',
  ITEM_CONFIRMED: 'Quantidade confirmada',
  ITEM_QUANTITY_CHANGED: 'Quantidade alterada',
  ITEM_REMOVED: 'Produto removido',
  OPENED: 'Comanda aberta',
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
                <Text style={styles.description}>
                  Adicionado em: {formatItemDateTime(item.createdAt)}
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
              <Text style={styles.description}>
                Adicionado em: {formatItemDateTime(item.createdAt)}
              </Text>
            </View>
          ))}
        </>
      )}
      <Text style={styles.totalText}>Total {formatCentsAsBrl(comanda.totalCents)}</Text>
    </View>
  );
}

function formatItemDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export function ComandaHistory({ comanda }: { comanda: Comanda }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Histórico</Text>
      {[...comanda.events].reverse().map((event, index) => (
        <View
          key={`${event.type}-${event.createdAt}-${index}`}
          style={styles.itemRow}
        >
          <Text style={styles.itemName}>{eventLabels[event.type]}</Text>
          {event.productName && (
            <Text style={styles.description}>{event.productName}</Text>
          )}
          <Text style={styles.description}>
            {event.actor?.name ?? 'Operador anterior à autenticação'} ·{' '}
            {new Date(event.createdAt).toLocaleString('pt-BR')}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ComandaActions({
  canCancel,
  canClose,
  canCreateCredit,
  credit,
  disabled,
  isClosing,
  onAddProducts,
  onBack,
  onCancel,
  onCancelCredit,
  onClose,
  onCloseAsCredit,
  onFinalizeCredit,
  readOnly,
  status,
}: {
  canCancel: boolean;
  canClose: boolean;
  canCreateCredit: boolean;
  credit: Comanda['credit'];
  disabled: boolean;
  isClosing: boolean;
  onAddProducts: () => void;
  onBack: () => void;
  onCancel: () => void;
  onCancelCredit: () => void;
  onClose: () => void;
  onCloseAsCredit: () => void;
  onFinalizeCredit: () => void;
  readOnly: boolean;
  status: Comanda['status'];
}) {
  if (readOnly) {
    return (
      <View style={styles.actions}>
        <Message
          text="Seu cargo permite consultar esta comanda, sem realizar alterações."
          tone="notice"
        />
        <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
      </View>
    );
  }

  if (status !== 'OPEN') {
    return <ActionButton label="Voltar" onPress={onBack} tone="secondary" />;
  }

  if (credit?.source === 'MANUAL' && credit.status === 'DRAFT') {
    return (
      <View style={styles.actions}>
        <ActionButton label="Adicionar produtos" onPress={onAddProducts} />
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
        <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
      </View>
    );
  }

  if (credit?.status === 'OPEN') {
    return (
      <View style={styles.actions}>
        <ActionButton label="Adicionar produtos" onPress={onAddProducts} />
        <Message
          text={
            canCreateCredit
              ? 'Este fiado está em aberto e pode receber novos itens.'
              : 'Confirme os itens novos antes de quitar este fiado.'
          }
          tone="notice"
        />
        <ActionButton label="Voltar" onPress={onBack} tone="secondary" />
      </View>
    );
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
      {!canCreateCredit && (
        <Message
          text="Para fechar como fiado, adicione produtos e confirme todos os itens."
          tone="notice"
        />
      )}
      <ActionButton
        disabled={disabled || !canCreateCredit}
        label="Fechar como fiado"
        onPress={onCloseAsCredit}
        tone="secondary"
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
