import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type {
  DeliveryCourierDetails,
  DeliveryDayDetails,
} from '../../services/deliveries-api';
import { DeliveryCouriersScreen } from '../delivery-couriers-screen';
import {
  DeliveryCourierScreen,
  resolvePeriod,
} from '../delivery-courier-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const courierDetails: DeliveryCourierDetails = {
  activeDayId: null,
  days: [
    {
      closedAt: '2026-08-10T23:00:00.000Z',
      courierId: 'courier-id',
      courierName: 'João',
      dailyRateCents: 8_000,
      deliveryCount: 3,
      expensesTotalCents: 5_000,
      feesTotalCents: 1_500,
      id: 'day-closed',
      openedAt: '2026-08-10T13:00:00.000Z',
      payoutCents: 4_500,
      salesTotalCents: 20_000,
      settlementPaidCents: 4_500,
      status: 'CLOSED',
    },
  ],
  id: 'courier-id',
  name: 'João',
  periodPayoutCents: 4_500,
  periodSettledCents: 4_500,
  settledTotalCents: 12_000,
};

const openedDay: DeliveryDayDetails = {
  closedAt: null,
  courierId: 'courier-id',
  courierName: 'João',
  dailyRateCents: 9_000,
  deliveries: [],
  deliveryCount: 0,
  expenses: [],
  expensesTotalCents: 0,
  feesTotalCents: 0,
  id: 'day-new',
  openedAt: '2026-08-11T13:00:00.000Z',
  payoutCents: 9_000,
  salesTotalCents: 0,
  settlementPaidCents: null,
  status: 'OPEN',
};

it('lists couriers with how much they already received', async () => {
  render(
    <DeliveryCouriersScreen
      apiBaseUrl="http://api.test"
      loadRequest={() =>
        Promise.resolve([
          {
            activeDayId: 'day-id',
            id: 'courier-id',
            name: 'João',
            settledTotalCents: 12_000,
          },
        ])
      }
      onBack={jest.fn()}
      onSelectCourier={jest.fn()}
    />,
  );

  expect(await screen.findByText('João')).toBeTruthy();
  expect(screen.getByText('Já recebeu R$ 120,00')).toBeTruthy();
  expect(screen.getByText('Dia aberto')).toBeTruthy();
});

it('registers a new courier', async () => {
  const createRequest = jest.fn().mockResolvedValue({
    activeDayId: null,
    id: 'courier-id',
    name: 'João',
    settledTotalCents: 0,
  });

  render(
    <DeliveryCouriersScreen
      apiBaseUrl="http://api.test"
      createRequest={createRequest}
      loadRequest={() => Promise.resolve([])}
      onBack={jest.fn()}
      onSelectCourier={jest.fn()}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', { name: 'Cadastrar entregador' }),
  );
  fireEvent.changeText(screen.getByLabelText('Nome do entregador'), 'João');
  fireEvent.press(
    screen.getByRole('button', { name: 'Cadastrar entregador' }),
  );

  await waitFor(() => {
    expect(createRequest).toHaveBeenCalledWith('http://api.test', 'João');
  });
});

it('starts a day with the informed daily rate', async () => {
  const openDayRequest = jest.fn().mockResolvedValue(openedDay);
  const onOpenDay = jest.fn();

  render(
    <DeliveryCourierScreen
      apiBaseUrl="http://api.test"
      courierId="courier-id"
      loadRequest={() => Promise.resolve(courierDetails)}
      onBack={jest.fn()}
      onOpenDay={onOpenDay}
      openDayRequest={openDayRequest}
    />,
  );

  fireEvent.changeText(
    await screen.findByLabelText('Valor da diária'),
    '9000',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Iniciar dia' }));

  await waitFor(() => {
    expect(openDayRequest).toHaveBeenCalledWith(
      'http://api.test',
      'courier-id',
      9_000,
    );
  });
  expect(onOpenDay).toHaveBeenCalledWith('day-new');
});

it('offers to resume the day when one is already open', async () => {
  const onOpenDay = jest.fn();

  render(
    <DeliveryCourierScreen
      apiBaseUrl="http://api.test"
      courierId="courier-id"
      loadRequest={() =>
        Promise.resolve({ ...courierDetails, activeDayId: 'day-open' })
      }
      onBack={jest.fn()}
      onOpenDay={onOpenDay}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', { name: 'Abrir o dia em andamento' }),
  );

  expect(onOpenDay).toHaveBeenCalledWith('day-open');
  expect(screen.queryByRole('button', { name: 'Iniciar dia' })).toBeNull();
});

it('reloads the history when the period filter changes', async () => {
  const loadRequest = jest.fn().mockResolvedValue(courierDetails);

  render(
    <DeliveryCourierScreen
      apiBaseUrl="http://api.test"
      courierId="courier-id"
      loadRequest={loadRequest}
      onBack={jest.fn()}
      onOpenDay={jest.fn()}
    />,
  );

  await screen.findByText('Histórico');
  expect(loadRequest).toHaveBeenLastCalledWith(
    'http://api.test',
    'courier-id',
    undefined,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Este mês' }));

  await waitFor(() => {
    expect(loadRequest).toHaveBeenLastCalledWith(
      'http://api.test',
      'courier-id',
      expect.objectContaining({ from: expect.any(String) }),
    );
  });
});

it('resolves the period filters as inclusive Sao Paulo dates', () => {
  const today = new Date(2026, 7, 11);

  expect(resolvePeriod('ALL', today)).toBeUndefined();
  expect(resolvePeriod('LAST_7_DAYS', today)).toEqual({
    from: '2026-08-05',
    to: '2026-08-11',
  });
  expect(resolvePeriod('THIS_MONTH', today)).toEqual({
    from: '2026-08-01',
    to: '2026-08-11',
  });
});
