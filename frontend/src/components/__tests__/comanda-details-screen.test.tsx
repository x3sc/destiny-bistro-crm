import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';

import type { Comanda } from '../../services/comandas-api';
import { themeColors } from '../../theme/tokens';
import { styles as comandaStyles } from '../comanda-details-screen.styles';
import { ComandaDetailsScreen } from '../comanda-details-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [
    {
      actor: null,
      createdAt: '2026-06-02T19:00:00.000Z',
      itemId: null,
      newQuantity: null,
      previousQuantity: null,
      productId: null,
      productName: null,
      reason: null,
      type: 'OPENED',
      unitPriceCents: null,
    },
  ],
  id: 'comanda-id',
  items: [],
  name: null,
  number: 42,
  openedAt: '2026-06-02T19:00:00.000Z',
  payments: [],
  status: 'OPEN',
  table: {
    id: 1,
    number: 1,
  },
  totalCents: 0,
};

const comandaWithItem: Comanda = {
  ...comanda,
  items: [
    {
      confirmedQuantity: 0,
      createdAt: '2026-06-02T19:05:00.000Z',
      id: 'item-id',
      productId: 'product-id',
      productName: 'Cafe',
      quantity: 1,
      subtotalCents: 600,
      unitPriceCents: 600,
    },
  ],
  totalCents: 600,
};

const namedComanda: Comanda = {
  ...comanda,
  name: 'João',
};

const comandaWithTwoItems: Comanda = {
  ...comandaWithItem,
  items: [
    {
      ...comandaWithItem.items[0],
      quantity: 2,
      subtotalCents: 1200,
    },
  ],
  totalCents: 1200,
};

const comandaWithConfirmedItem: Comanda = {
  ...comandaWithItem,
  items: [
    {
      ...comandaWithItem.items[0],
      confirmedQuantity: 1,
    },
  ],
};

const comandaWithConfirmedAndNewItem: Comanda = {
  ...comandaWithTwoItems,
  items: [
    {
      ...comandaWithTwoItems.items[0],
      confirmedQuantity: 1,
    },
  ],
};

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows comanda details', async () => {
  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comanda)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  expect(await screen.findByText('Comanda #42')).toBeTruthy();
  expect(screen.getByText('Mesa 1')).toBeTruthy();
  expect(screen.getByText('• Aberta')).toBeTruthy();
  expect(screen.getByText(/Nenhum item/)).toBeTruthy();
  expect(screen.getByLabelText('Total R$ 0,00')).toBeTruthy();
  expect(screen.queryByText('Histórico')).toBeNull();
});

it('uses the shared light theme on the comanda screen', () => {
  expect(comandaStyles.safeArea).toEqual(
    expect.objectContaining({ backgroundColor: themeColors.background }),
  );
  expect(comandaStyles.card).toEqual(
    expect.objectContaining({ backgroundColor: themeColors.surface }),
  );
  expect(comandaStyles.button).toEqual(
    expect.objectContaining({ backgroundColor: themeColors.primary }),
  );
});

it('shows the comanda name when the table was named', async () => {
  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(namedComanda)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  expect(await screen.findByText(/João/)).toBeTruthy();
});

it('opens the product catalog from comanda details', async () => {
  const onAddProducts = jest.fn();

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comanda)}
      onAddProducts={onAddProducts}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Adicionar produtos' }));
  expect(onAddProducts).toHaveBeenCalledWith('comanda-id');
});

it('uses alert confirmation before cancelling an empty comanda', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation();
  const cancelRequest = jest.fn(() => Promise.resolve(comanda));
  const onCancelled = jest.fn();

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      cancelRequest={cancelRequest}
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comanda)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={onCancelled}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Cancelar comanda vazia' }));
  expect(cancelRequest).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    'Cancelar comanda',
    'Deseja cancelar esta comanda vazia e liberar a mesa?',
    expect.any(Array),
  );

  const alertButtons = alertSpy.mock.calls[0][2];
  alertButtons?.[0]?.onPress?.();
  expect(cancelRequest).not.toHaveBeenCalled();

  await act(async () => {
    alertButtons?.[1]?.onPress?.();
  });

  expect(await screen.findByText('Cancelando...')).toBeTruthy();
  expect(cancelRequest).toHaveBeenCalledWith('http://192.168.0.10:3333', 'comanda-id');
  expect(onCancelled).toHaveBeenCalled();
});

it('uses browser confirm before cancelling an empty comanda on web', async () => {
  const originalPlatform = Platform.OS;
  const originalConfirm = globalThis.confirm;
  const cancelRequest = jest.fn(() => Promise.resolve(comanda));
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });
  globalThis.confirm = jest.fn(() => true);

  try {
    render(
      <ComandaDetailsScreen
        apiBaseUrl="http://192.168.0.10:3333"
        cancelRequest={cancelRequest}
        comandaId="comanda-id"
        loadRequest={() => Promise.resolve(comanda)}
        onAddProducts={jest.fn()}
        onBack={jest.fn()}
        onCancelled={jest.fn()}
      />,
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Cancelar comanda vazia' }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Deseja cancelar esta comanda vazia e liberar a mesa?',
    );
    await waitFor(() => {
      expect(cancelRequest).toHaveBeenCalledWith(
        'http://192.168.0.10:3333',
        'comanda-id',
      );
    });
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
    globalThis.confirm = originalConfirm;
  }
});

it('does not cancel an empty comanda when browser confirm is cancelled', async () => {
  const originalPlatform = Platform.OS;
  const originalConfirm = globalThis.confirm;
  const cancelRequest = jest.fn(() => Promise.resolve(comanda));
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });
  globalThis.confirm = jest.fn(() => false);

  try {
    render(
      <ComandaDetailsScreen
        apiBaseUrl="http://192.168.0.10:3333"
        cancelRequest={cancelRequest}
        comandaId="comanda-id"
        loadRequest={() => Promise.resolve(comanda)}
        onAddProducts={jest.fn()}
        onBack={jest.fn()}
        onCancelled={jest.fn()}
      />,
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Cancelar comanda vazia' }));

    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Deseja cancelar esta comanda vazia e liberar a mesa?',
    );
    expect(cancelRequest).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
    globalThis.confirm = originalConfirm;
  }
});

it('shows items, total and blocks cancellation when the comanda has consumption', async () => {
  const onCheckout = jest.fn();

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comandaWithItem)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
      onCheckout={onCheckout}
    />,
  );

  expect(await screen.findByText('Cafe')).toBeTruthy();
  expect(screen.getByText('Itens em aberto')).toBeTruthy();
  expect(screen.getByText('Itens confirmados')).toBeTruthy();
  expect(screen.getByText('Nenhum item confirmado.')).toBeTruthy();
  expect(screen.getByText('1 x R$ 6,00 = R$ 6,00')).toBeTruthy();
  expect(screen.getByLabelText('Total R$ 6,00')).toBeTruthy();
  expect(screen.queryByText(/Remova todos os itens/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancelar comanda vazia' })).toBeNull();
  expect(screen.queryByText(/Confirme todos os itens novos/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Fechar mesa' }));
  expect(onCheckout).not.toHaveBeenCalled();
});

it('opens the unified checkout after all item quantities are confirmed', async () => {
  const onCheckout = jest.fn();

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comandaWithConfirmedItem)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
      onCheckout={onCheckout}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Fechar mesa' }));
  expect(onCheckout).toHaveBeenCalledWith(comandaWithConfirmedItem);
});

it('confirms a new item using the tick action', async () => {
  const confirmItemRequest = jest.fn(() => Promise.resolve(comandaWithConfirmedItem));

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      confirmItemRequest={confirmItemRequest}
      loadRequest={() => Promise.resolve(comandaWithItem)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Confirmar Cafe' }));

  await waitFor(() => {
    expect(confirmItemRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
    );
  });
  expect(await screen.findByText('Nenhum item em aberto.')).toBeTruthy();
  expect(screen.getByText('1 x R$ 6,00 = R$ 6,00')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '-' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remover Cafe' })).toBeNull();
});

it('shows confirmed and new quantities in separate divisions', async () => {
  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comandaWithConfirmedAndNewItem)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  expect(await screen.findAllByText('Cafe')).toHaveLength(2);
  expect(screen.getByText('Itens em aberto')).toBeTruthy();
  expect(screen.getByText('Itens confirmados')).toBeTruthy();
  expect(screen.getAllByText('1 x R$ 6,00 = R$ 6,00')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Confirmar Cafe' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '-' })).toBeTruthy();
});

it('increments and decrements item quantity', async () => {
  const changeItemQuantityRequest = jest
    .fn()
    .mockResolvedValueOnce(comandaWithTwoItems)
    .mockResolvedValueOnce(comandaWithItem);

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      changeItemQuantityRequest={changeItemQuantityRequest}
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comandaWithTwoItems)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: '+' }));
  await waitFor(() => {
    expect(changeItemQuantityRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
      1,
    );
  });

  fireEvent.press(screen.getByRole('button', { name: '-' }));
  await waitFor(() => {
    expect(changeItemQuantityRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
      -1,
    );
  });
});

it('uses a trash action with alert confirmation to remove the full item line', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation();
  const removeItemRequest = jest.fn(() => Promise.resolve(comanda));

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comandaWithItem)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
      removeItemRequest={removeItemRequest}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Remover Cafe' }));
  expect(removeItemRequest).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(
    'Remover item',
    'Deseja remover Cafe da comanda?',
    expect.any(Array),
  );

  const alertButtons = alertSpy.mock.calls[0][2];
  alertButtons?.[0]?.onPress?.();
  expect(removeItemRequest).not.toHaveBeenCalled();

  await act(async () => {
    alertButtons?.[1]?.onPress?.();
  });

  await waitFor(() => {
    expect(removeItemRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
    );
  });
});

it('uses browser confirm before removing an item on web', async () => {
  const originalPlatform = Platform.OS;
  const originalConfirm = globalThis.confirm;
  const removeItemRequest = jest.fn(() => Promise.resolve(comanda));
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });
  globalThis.confirm = jest.fn(() => true);

  try {
    render(
      <ComandaDetailsScreen
        apiBaseUrl="http://192.168.0.10:3333"
        comandaId="comanda-id"
        loadRequest={() => Promise.resolve(comandaWithItem)}
        onAddProducts={jest.fn()}
        onBack={jest.fn()}
        onCancelled={jest.fn()}
        removeItemRequest={removeItemRequest}
      />,
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Remover Cafe' }));

    expect(globalThis.confirm).toHaveBeenCalledWith('Deseja remover Cafe da comanda?');
    await waitFor(() => {
      expect(removeItemRequest).toHaveBeenCalledWith(
        'http://192.168.0.10:3333',
        'comanda-id',
        'item-id',
      );
    });
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
    globalThis.confirm = originalConfirm;
  }
});

it('does not remove an item when browser confirm is cancelled', async () => {
  const originalPlatform = Platform.OS;
  const originalConfirm = globalThis.confirm;
  const removeItemRequest = jest.fn(() => Promise.resolve(comanda));
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });
  globalThis.confirm = jest.fn(() => false);

  try {
    render(
      <ComandaDetailsScreen
        apiBaseUrl="http://192.168.0.10:3333"
        comandaId="comanda-id"
        loadRequest={() => Promise.resolve(comandaWithItem)}
        onAddProducts={jest.fn()}
        onBack={jest.fn()}
        onCancelled={jest.fn()}
        removeItemRequest={removeItemRequest}
      />,
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Remover Cafe' }));

    expect(globalThis.confirm).toHaveBeenCalledWith('Deseja remover Cafe da comanda?');
    expect(removeItemRequest).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
    globalThis.confirm = originalConfirm;
  }
});

it('finalizes a manual credit draft after every item is confirmed', async () => {
  const finalizeCreditRequest = jest.fn(() =>
    Promise.resolve({
      balanceCents: 600,
      cancelledAt: null,
      comandaId: 'comanda-id',
      comandaName: 'Maria',
      comandaNumber: 42,
      customerId: 'customer-id',
      customerName: 'Maria',
      finalizedAt: '2026-06-02T20:00:00.000Z',
      hasPendingItems: false,
      id: 'order-id',
      orderedAt: '2026-06-02T19:00:00.000Z',
      paidCents: 0,
      payments: [],
      settledAt: null,
      source: 'MANUAL' as const,
      status: 'OPEN' as const,
      tableNumber: null,
      totalCents: 600,
    }),
  );
  const onCreditFinished = jest.fn();

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://localhost:3333"
      comandaId="comanda-id"
      finalizeCreditRequest={finalizeCreditRequest}
      loadRequest={() =>
        Promise.resolve({
          ...comandaWithConfirmedItem,
          credit: {
            balanceCents: 600,
            customerId: 'customer-id',
            customerName: 'Maria',
            orderId: 'order-id',
            paidCents: 0,
            source: 'MANUAL',
            status: 'DRAFT',
            totalCents: 600,
          },
          name: 'Maria',
          table: null,
        })
      }
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
      onCreditFinished={onCreditFinished}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Finalizar fiado' }));

  await waitFor(() => {
    expect(finalizeCreditRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'order-id',
    );
    expect(onCreditFinished).toHaveBeenCalledWith('customer-id');
  });
});

it('does not expose a separate close-as-credit action', async () => {

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://localhost:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comandaWithConfirmedItem)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
      onCheckout={jest.fn()}
    />,
  );

  expect(await screen.findByRole('button', { name: 'Fechar mesa' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Fechar como fiado' })).toBeNull();
});

it('shows an error when loading fails', async () => {
  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.reject(new Error('offline'))}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  expect(await screen.findByText(/foi poss/)).toBeTruthy();
});
