import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import type { KitchenTicket } from '../../services/kitchen-api';
import { KitchenScreen } from '../kitchen-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const ticket: KitchenTicket = {
  comandaId: 'comanda-id',
  comandaNumber: 32,
  createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  id: 'ticket-id',
  items: [
    {
      comandaItemId: 'item-id',
      configurations: [
        {
          additionals: [
            {
              additionalId: 'bacon-id',
              additionalName: 'Bacon',
              id: 'ticket-additional-id',
              quantityPerUnit: 1,
            },
          ],
          configurationKey: 'with-bacon',
          id: 'ticket-configuration-id',
          quantity: 2,
        },
      ],
      id: 'ticket-item-id',
      productId: 'burger-id',
      productName: 'Hambúrguer',
      quantity: 2,
    },
  ],
  status: 'PENDING',
  table: { id: 8, number: 8 },
  updatedAt: new Date().toISOString(),
};

it('shows the oldest kitchen work and advances its status', async () => {
  const updateRequest = jest
    .fn()
    .mockResolvedValue({ ...ticket, status: 'PREPARING' });
  render(
    <KitchenScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={jest.fn().mockResolvedValue([ticket])}
      onBack={jest.fn()}
      updateRequest={updateRequest}
    />,
  );

  expect(await screen.findByText('COMANDA #32')).toBeTruthy();
  expect(screen.getByText(/Mesa 8/)).toBeTruthy();
  expect(screen.getByText('2x Hambúrguer')).toBeTruthy();
  expect(screen.getByText('+ 1x Bacon')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Iniciar preparo' }));

  await waitFor(() =>
    expect(updateRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'ticket-id',
      'PREPARING',
    ),
  );
  expect(await screen.findByText('Em preparo')).toBeTruthy();
});

it('keeps the queue read-only without kitchen.write', async () => {
  render(
    <KitchenScreen
      apiBaseUrl="http://localhost:3333"
      canWrite={false}
      loadRequest={jest.fn().mockResolvedValue([ticket])}
      onBack={jest.fn()}
    />,
  );

  expect(await screen.findByText('COMANDA #32')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Iniciar preparo' }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancelar ticket' })).toBeNull();
});

it('shows an empty kitchen queue', async () => {
  render(
    <KitchenScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={jest.fn().mockResolvedValue([])}
      onBack={jest.fn()}
    />,
  );

  expect(await screen.findByText('Nenhum item aguardando preparo.')).toBeTruthy();
});

it('retries after an error and supports manual refresh', async () => {
  const loadRequest = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...ticket, table: null }]);
  render(
    <KitchenScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={loadRequest}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', { name: 'Tentar novamente' }),
  );
  expect(await screen.findByText('Nenhum item aguardando preparo.')).toBeTruthy();

  const refreshControl =
    screen.UNSAFE_getByType(ScrollView).props.refreshControl;
  await act(async () => {
    refreshControl.props.onRefresh();
  });

  expect(await screen.findByText(/Delivery/)).toBeTruthy();
  expect(loadRequest).toHaveBeenCalledTimes(3);
});
