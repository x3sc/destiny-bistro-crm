import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { DeliveryDayDetails } from '../../services/deliveries-api';
import { DeliveryDayScreen } from '../delivery-day-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const openDay: DeliveryDayDetails = {
  closedAt: null,
  courierId: 'courier-id',
  courierName: 'João',
  dailyRateCents: 8_000,
  deliveries: [
    {
      address: 'Rua das Flores, 120',
      customerName: 'Marina',
      deliveredAt: '2026-08-11T21:00:00.000Z',
      feeCents: 500,
      id: 'delivery-1',
      paymentMethod: 'PIX',
      products: 'Pizza calabresa',
      recordedBy: { id: 'user-id', name: 'Operador' },
      totalCents: 5_000,
    },
  ],
  deliveryCount: 1,
  expenses: [
    {
      amountCents: 5_000,
      createdAt: '2026-08-11T22:00:00.000Z',
      description: 'Gasolina',
      id: 'expense-1',
      recordedBy: { id: 'user-id', name: 'Operador' },
    },
  ],
  expensesTotalCents: 5_000,
  feesTotalCents: 500,
  id: 'day-id',
  openedAt: '2026-08-11T18:00:00.000Z',
  payoutCents: 3_500,
  salesTotalCents: 5_000,
  settlementPaidCents: null,
  status: 'OPEN',
};

function renderScreen(overrides: Partial<Parameters<typeof DeliveryDayScreen>[0]> = {}) {
  return render(
    <DeliveryDayScreen
      apiBaseUrl="http://api.test"
      dayId="day-id"
      loadRequest={() => Promise.resolve(openDay)}
      onBack={jest.fn()}
      {...overrides}
    />,
  );
}

it('shows the payout as daily rate plus fees minus expenses', async () => {
  renderScreen();

  expect(await screen.findByText('A pagar ao entregador')).toBeTruthy();
  // O valor aparece no destaque do topo e na linha Total do resumo.
  expect(screen.getAllByText('R$ 35,00')).toHaveLength(2);
  expect(screen.getByText('Diária')).toBeTruthy();
  expect(screen.getByText('R$ 80,00')).toBeTruthy();
  expect(screen.getByText('Taxas de 1 entrega')).toBeTruthy();
  // A despesa aparece no resumo do acerto e na lista de despesas.
  expect(screen.getAllByText('- R$ 50,00')).toHaveLength(2);
});

it('lists the deliveries with address, products and payment method', async () => {
  renderScreen();

  expect(await screen.findByText('Marina')).toBeTruthy();
  expect(screen.getByText('Rua das Flores, 120')).toBeTruthy();
  expect(screen.getByText('Pizza calabresa')).toBeTruthy();
  expect(screen.getByText('Pix')).toBeTruthy();
});

it('records a delivery and shows what the bistro keeps', async () => {
  const recordRequest = jest.fn().mockResolvedValue(openDay);
  renderScreen({ recordRequest });

  fireEvent.press(await screen.findByRole('button', { name: 'Registrar entrega' }));
  fireEvent.changeText(screen.getByLabelText('Nome do cliente'), 'Bruno');
  fireEvent.changeText(screen.getByLabelText('Endereço'), 'Avenida Central, 44');
  fireEvent.changeText(screen.getByLabelText('Valor total da entrega'), '4000');
  fireEvent.changeText(screen.getByLabelText('Taxa de entrega'), '600');

  expect(screen.getByText(/O bistrô fica com R\$ 34,00/u)).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Débito'));
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar entrega' }));

  await waitFor(() => {
    expect(recordRequest).toHaveBeenCalledWith('http://api.test', 'day-id', {
      address: 'Avenida Central, 44',
      customerName: 'Bruno',
      feeCents: 600,
      paymentMethod: 'DEBIT_CARD',
      products: null,
      totalCents: 4_000,
    });
  });
});

it('keeps the delivery confirmation disabled until the required fields are filled', async () => {
  const recordRequest = jest.fn().mockResolvedValue(openDay);
  renderScreen({ recordRequest });

  fireEvent.press(await screen.findByRole('button', { name: 'Registrar entrega' }));
  fireEvent.changeText(screen.getByLabelText('Nome do cliente'), 'Bruno');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar entrega' }));

  expect(recordRequest).not.toHaveBeenCalled();
});

it('records an expense that is deducted from the courier payout', async () => {
  const expenseRequest = jest.fn().mockResolvedValue(openDay);
  renderScreen({ expenseRequest });

  fireEvent.press(await screen.findByRole('button', { name: 'Registrar despesa' }));
  fireEvent.changeText(screen.getByLabelText('Descrição'), 'Gasolina');
  fireEvent.changeText(screen.getByLabelText('Valor'), '5000');
  fireEvent.press(screen.getByRole('button', { name: 'Registrar despesa' }));

  await waitFor(() => {
    expect(expenseRequest).toHaveBeenCalledWith('http://api.test', 'day-id', {
      amountCents: 5_000,
      description: 'Gasolina',
    });
  });
});

it('closes the day and settles the payout', async () => {
  const closeRequest = jest.fn().mockResolvedValue({
    ...openDay,
    closedAt: '2026-08-11T23:00:00.000Z',
    settlementPaidCents: 3_500,
    status: 'CLOSED',
  });
  renderScreen({ closeRequest });

  fireEvent.press(
    await screen.findByRole('button', { name: 'Fechar dia e pagar R$ 35,00' }),
  );

  await waitFor(() => {
    expect(closeRequest).toHaveBeenCalledWith('http://api.test', 'day-id');
  });
  expect(await screen.findByText('Pago ao entregador')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Registrar entrega' }),
  ).toBeNull();
});

it('hides the actions when the day is already closed', async () => {
  renderScreen({
    loadRequest: () =>
      Promise.resolve({
        ...openDay,
        closedAt: '2026-08-11T23:00:00.000Z',
        settlementPaidCents: 3_500,
        status: 'CLOSED' as const,
      }),
  });

  expect(await screen.findByText('Pago ao entregador')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Registrar despesa' })).toBeNull();
});
