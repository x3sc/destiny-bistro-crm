import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import type { DeliveryOrder } from '../../services/deliveries-api';
import { DeliveryOrderDetailsScreen } from '../delivery-order-details-screen';
import { DeliveryOrdersScreen } from '../delivery-orders-screen';
import { NewDeliveryOrderScreen } from '../new-delivery-order-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const order: DeliveryOrder = {
  address: 'Rua das Flores, 120',
  comandaId: 'comanda-id',
  comandaNumber: 43,
  courierName: null,
  createdAt: '2026-08-11T18:00:00.000Z',
  customerName: 'Marina',
  dayId: null,
  deliveredAt: null,
  dispatchedAt: null,
  feeCents: 500,
  hasPendingItems: false,
  id: 'order-id',
  itemCount: 2,
  paidCents: 0,
  paymentStatus: 'OPEN',
  phone: '11999999999',
  status: 'NEW',
  totalCents: 2500,
  updatedAt: '2026-08-11T18:00:00.000Z',
};

const comand: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [],
  id: 'comanda-id',
  items: [
    {
      confirmedQuantity: 2,
      createdAt: order.createdAt,
      id: 'item-id',
      productId: 'product-id',
      productName: 'X-Burger',
      quantity: 2,
      subtotalCents: 2000,
      unitPriceCents: 1000,
    },
  ],
  name: 'Marina',
  number: 43,
  openedAt: order.createdAt,
  payments: [],
  status: 'OPEN',
  table: null,
  totalCents: 2500,
};

it('organizes active orders and moves delivered orders to history', async () => {
  const delivered = {
    ...order,
    deliveredAt: order.updatedAt,
    id: 'delivered-id',
    status: 'DELIVERED' as const,
  };
  render(
    <DeliveryOrdersScreen
      apiBaseUrl="http://api.test"
      loadRequest={() => Promise.resolve([order, delivered])}
      onBack={jest.fn()}
      onCouriers={jest.fn()}
      onNewOrder={jest.fn()}
      onSelectOrder={jest.fn()}
    />,
  );

  expect(await screen.findByText('Pedido #43')).toBeTruthy();
  expect(screen.queryByText('Entregue')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Histórico' }));
  expect(screen.getAllByText('Histórico').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Abrir pedido 43' })).toBeTruthy();
});

it('hides creation actions for delivery read-only access', async () => {
  render(
    <DeliveryOrdersScreen
      apiBaseUrl="http://api.test"
      canWrite={false}
      loadRequest={() => Promise.resolve([order])}
      onBack={jest.fn()}
      onCouriers={jest.fn()}
      onNewOrder={jest.fn()}
      onSelectOrder={jest.fn()}
    />,
  );

  expect(await screen.findByText('Pedido #43')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Novo pedido' })).toBeNull();
});

it('creates a manual order before opening the catalog', async () => {
  const createRequest = jest.fn().mockResolvedValue(order);
  const onCreated = jest.fn();
  render(
    <NewDeliveryOrderScreen
      apiBaseUrl="http://api.test"
      createRequest={createRequest}
      onBack={jest.fn()}
      onCreated={onCreated}
    />,
  );

  fireEvent.changeText(screen.getByLabelText('Nome do cliente'), 'Marina');
  fireEvent.changeText(screen.getByLabelText('Telefone'), '11999999999');
  expect(screen.getByLabelText('Telefone').props.value).toBe('(11) 99999-9999');
  fireEvent.changeText(screen.getByLabelText('Endereço'), order.address);
  fireEvent.changeText(screen.getByLabelText('Taxa de entrega'), '500');
  fireEvent.press(
    screen.getByRole('button', { name: 'Continuar para o cardápio' }),
  );

  await waitFor(() => {
    expect(createRequest).toHaveBeenCalledWith('http://api.test', {
      address: order.address,
      customerName: 'Marina',
      feeCents: 500,
      phone: '11999999999',
    });
  });
  expect(onCreated).toHaveBeenCalledWith(order);
});

it('limits and validates the Brazilian mobile phone format', async () => {
  const createRequest = jest.fn();
  render(
    <NewDeliveryOrderScreen
      apiBaseUrl="http://api.test"
      createRequest={createRequest}
      onBack={jest.fn()}
      onCreated={jest.fn()}
    />,
  );

  fireEvent.changeText(screen.getByLabelText('Nome do cliente'), 'Marina');
  fireEvent.changeText(screen.getByLabelText('Endereço'), order.address);
  fireEvent.changeText(
    screen.getByLabelText('Telefone'),
    '2222222222222222222222',
  );

  expect(screen.getByLabelText('Telefone').props.value).toBe('(22) 22222-2222');
  expect(
    screen.getByText(
      'Informe um celular com DDD no formato (11) 99999-9999.',
    ),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Continuar para o cardápio' }),
  );
  expect(createRequest).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText('Telefone'), '11987654321');

  expect(screen.getByLabelText('Telefone').props.value).toBe('(11) 98765-4321');
  expect(
    screen.queryByText(
      'Informe um celular com DDD no formato (11) 99999-9999.',
    ),
  ).toBeNull();
});

it('reuses confirmed comanda items and advances the delivery workflow', async () => {
  const advanceRequest = jest
    .fn()
    .mockResolvedValue({ ...order, status: 'PREPARING' });
  render(
    <DeliveryOrderDetailsScreen
      advanceRequest={advanceRequest}
      apiBaseUrl="http://api.test"
      loadComandaRequest={() => Promise.resolve(comand)}
      loadCouriersRequest={() => Promise.resolve([])}
      loadOrderRequest={() => Promise.resolve(order)}
      onAddProducts={jest.fn()}
      onBack={jest.fn()}
      onCheckout={jest.fn()}
      orderId={order.id}
    />,
  );

  expect(await screen.findByText('2× X-Burger')).toBeTruthy();
  expect(screen.getByText('Taxa de entrega')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Iniciar preparo' }));

  await waitFor(() => {
    expect(advanceRequest).toHaveBeenCalledWith(
      'http://api.test',
      order.id,
      'PREPARING',
      undefined,
    );
  });
});
