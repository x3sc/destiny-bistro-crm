import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import type {
  CreditCustomerDetails,
  CreditOrder,
} from '../../services/credits-api';
import { formatCentsAsBrl } from '../../services/money';
import {
  themeRadii,
  themeSpacing,
} from '../../theme/tokens';
import { ComandaCheckoutScreen } from '../comanda-checkout-screen';
import { creditStyles } from '../credit-screens.styles';
import { CreditPaymentScreen } from '../credit-payment-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

function selectMethod(paymentNumber: number, method: string) {
  fireEvent.press(
    screen.getByRole('button', { name: `Forma de pagamento ${paymentNumber}` }),
  );
  fireEvent.press(
    screen.getByRole('button', {
      name: `Selecionar ${method} no pagamento ${paymentNumber}`,
    }),
  );
}

const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [],
  id: 'comanda-id',
  items: [],
  name: 'Mesa teste',
  number: 10,
  openedAt: '2026-08-03T12:00:00.000Z',
  payments: [],
  status: 'OPEN',
  table: { id: 1, number: 1 },
  totalCents: 5000,
};

const order: CreditOrder = {
  balanceCents: 1500,
  cancelledAt: null,
  comandaId: 'credit-comanda-id',
  comandaName: 'Maria',
  comandaNumber: 11,
  customerId: 'customer-id',
  customerName: 'Maria',
  finalizedAt: '2026-08-03T12:00:00.000Z',
  hasPendingItems: false,
  id: 'order-id',
  orderedAt: '2026-08-03T12:00:00.000Z',
  paidCents: 500,
  payments: [],
  settledAt: null,
  source: 'TABLE',
  status: 'OPEN',
  tableNumber: 1,
  totalCents: 2000,
};

it('uses the Stitch spacing and radius tokens on checkout surfaces', () => {
  expect(creditStyles.content).toEqual(
    expect.objectContaining({ paddingHorizontal: themeSpacing.mobileMargin }),
  );
  expect(creditStyles.button).toEqual(
    expect.objectContaining({ borderRadius: themeRadii.standard }),
  );
});

it('closes a table with mixed partial payment and a selected customer', async () => {
  const closeRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      credit: {
        balanceCents: 1500,
        customerId: 'customer-id',
        customerName: 'Maria',
        orderId: 'order-id',
        paidCents: 3500,
        source: 'TABLE' as const,
        status: 'OPEN' as const,
        totalCents: 5000,
      },
      table: null,
    }),
  );
  const onFinished = jest.fn();

  render(
    <ComandaCheckoutScreen
      apiBaseUrl="http://localhost:3333"
      closeRequest={closeRequest}
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadCustomersRequest={() =>
        Promise.resolve([
          {
            balanceCents: 1500,
            draftOrderCount: 0,
            id: 'customer-id',
            name: 'Maria',
            openOrderCount: 1,
          },
        ])
      }
      onBack={jest.fn()}
      onFinished={onFinished}
    />,
  );

  fireEvent.changeText(await screen.findByLabelText('Valor do pagamento 1'), '2000');
  selectMethod(1, 'Dinheiro');
  fireEvent.press(screen.getByRole('button', { name: /Adicionar outra forma/ }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 2'), '1500');
  selectMethod(2, 'Pix');
  expect(screen.getByText('Total da comanda')).toBeTruthy();
  expect(screen.getByTestId('checkout-footer')).toBeTruthy();
  expect(screen.getByText(`Restante: ${formatCentsAsBrl(1500)}`)).toBeTruthy();
  expect(
    screen.getByText(
      'O saldo restante será registrado no fiado e exige uma pessoa responsável.',
    ),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Confirmar e deixar saldo em fiado' }),
  );
  expect(screen.getByText('Selecionar fiado')).toBeTruthy();
  expect(screen.getByText('Fechar mesa')).toBeTruthy();
  expect(screen.queryByText('Maria')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Buscar cadastrados' }));
  fireEvent.changeText(screen.getByLabelText('Buscar pessoa cadastrada'), 'mari');
  fireEvent.press(screen.getByText('Maria'));
  expect(screen.getByText('Responsável: Maria')).toBeTruthy();
  expect(
    screen.getByText(`Novo saldo: ${formatCentsAsBrl(1500)}`),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Confirmar fiado e fechar mesa' }),
  );

  await waitFor(() => {
    expect(closeRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'comanda-id',
      [
        { amountCents: 2000, method: 'CASH' },
        { amountCents: 1500, method: 'PIX' },
      ],
      'customer-id',
    );
    expect(onFinished).toHaveBeenCalledWith('customer-id');
  });
});

it('creates and selects a new credit without leaving checkout', async () => {
  const customer = {
    balanceCents: 0,
    draftOrderCount: 0,
    id: 'new-customer-id',
    name: 'Joana',
    openOrderCount: 0,
  };
  const createCustomerRequest = jest.fn(() => Promise.resolve(customer));
  const closeRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      credit: {
        balanceCents: 5000,
        customerId: customer.id,
        customerName: customer.name,
        orderId: 'new-order-id',
        paidCents: 0,
        source: 'TABLE' as const,
        status: 'OPEN' as const,
        totalCents: 5000,
      },
      table: null,
    }),
  );

  render(
    <ComandaCheckoutScreen
      apiBaseUrl="http://localhost:3333"
      closeRequest={closeRequest}
      comandaId="comanda-id"
      createCustomerRequest={createCustomerRequest}
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadCustomersRequest={() => Promise.resolve([])}
      onBack={jest.fn()}
      onFinished={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Fechar como fiado' }));
  expect(screen.getByRole('button', { name: 'Buscar cadastrados' })).toBeTruthy();
  expect(screen.queryByLabelText('Buscar pessoa cadastrada')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Nome da pessoa'), 'Joana');
  fireEvent.press(screen.getByRole('button', { name: 'Cadastrar novo fiado' }));

  await waitFor(() => {
    expect(createCustomerRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'Joana',
    );
    expect(
      screen.getByRole('button', { name: 'Confirmar fiado e fechar mesa' }).props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: false }));
  });
  fireEvent.press(
    screen.getByRole('button', { name: 'Confirmar fiado e fechar mesa' }),
  );

  await waitFor(() => {
    expect(closeRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'comanda-id',
      [],
      'new-customer-id',
    );
  });
});

it('searches only customers who already have an open credit', async () => {
  render(
    <ComandaCheckoutScreen
      apiBaseUrl="http://localhost:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadCustomersRequest={() =>
        Promise.resolve([
          {
            balanceCents: 1199,
            draftOrderCount: 0,
            id: 'far-id',
            name: 'FAR',
            openOrderCount: 1,
          },
          {
            balanceCents: 0,
            draftOrderCount: 1,
            id: 'gustavo-id',
            name: 'Gustavo',
            openOrderCount: 1,
          },
          {
            balanceCents: 300,
            draftOrderCount: 0,
            id: 'maria-id',
            name: 'Maria',
            openOrderCount: 1,
          },
        ])
      }
      onBack={jest.fn()}
      onFinished={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Fechar como fiado' }));

  expect(screen.queryByText('FAR')).toBeNull();
  expect(screen.queryByText('Gustavo')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Buscar cadastrados' }));

  expect(screen.getByText('FAR')).toBeTruthy();
  expect(screen.getByText('Maria')).toBeTruthy();
  expect(screen.queryByText('Gustavo')).toBeNull();

  fireEvent.changeText(screen.getByLabelText('Buscar pessoa cadastrada'), 'mari');

  expect(screen.queryByText('FAR')).toBeNull();
  expect(screen.getByText('Maria')).toBeTruthy();
});

it('allows a full table payment when credit customers are unavailable', async () => {
  const closed = { ...comanda, closedAt: '2026-08-03T13:00:00.000Z', status: 'CLOSED' as const };
  const closeRequest = jest.fn(() => Promise.resolve(closed));

  render(
    <ComandaCheckoutScreen
      apiBaseUrl="http://localhost:3333"
      closeRequest={closeRequest}
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadCustomersRequest={() => Promise.reject(new Error('forbidden'))}
      onBack={jest.fn()}
      onFinished={jest.fn()}
    />,
  );

  fireEvent.changeText(await screen.findByLabelText('Valor do pagamento 1'), '5000');
  selectMethod(1, 'Pix');
  fireEvent.press(
    screen.getByRole('button', { name: 'Confirmar e fechar mesa' }),
  );

  await waitFor(() => {
    expect(closeRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'comanda-id',
      [{ amountCents: 5000, method: 'PIX' }],
      undefined,
    );
  });
});

it('registers a mixed installment only on the selected credit order', async () => {
  const customer: CreditCustomerDetails = {
    balanceCents: 1500,
    draftOrderCount: 0,
    id: 'customer-id',
    name: 'Maria',
    openOrderCount: 1,
    orders: [order, { ...order, id: 'other-order-id' }],
  };
  const settleRequest = jest.fn(() => Promise.resolve({ order } as never));
  const onFinished = jest.fn();

  render(
    <CreditPaymentScreen
      apiBaseUrl="http://localhost:3333"
      customerId="customer-id"
      loadRequest={() => Promise.resolve(customer)}
      onBack={jest.fn()}
      onFinished={onFinished}
      orderId="order-id"
      settleRequest={settleRequest}
    />,
  );

  fireEvent.changeText(await screen.findByLabelText('Valor do pagamento 1'), '1000');
  selectMethod(1, 'Pix');
  fireEvent.press(screen.getByRole('button', { name: /Adicionar outra forma/ }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 2'), '500');
  selectMethod(2, 'Cartão de débito');
  fireEvent.press(screen.getByRole('button', { name: 'Registrar pagamento' }));

  await waitFor(() => {
    expect(settleRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'order-id',
      [
        { amountCents: 1000, method: 'PIX' },
        { amountCents: 500, method: 'DEBIT_CARD' },
      ],
    );
    expect(onFinished).toHaveBeenCalled();
  });
});
