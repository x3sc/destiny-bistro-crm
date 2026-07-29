import { fireEvent, render, screen } from '@testing-library/react-native';

import type {
  CreditCustomerDetails,
  CreditOrder,
} from '../../services/credits-api';
import { CreditCustomerDetailsScreen } from '../credit-customer-details-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const draft: CreditOrder = {
  cancelledAt: null,
  comandaId: 'comanda-draft',
  comandaName: 'Maria',
  comandaNumber: 42,
  customerId: 'customer-id',
  customerName: 'Maria',
  finalizedAt: null,
  hasPendingItems: false,
  id: 'draft-id',
  orderedAt: '2026-07-28T18:00:00.000Z',
  settledAt: null,
  source: 'MANUAL',
  status: 'DRAFT',
  tableNumber: null,
  totalCents: 0,
};
const openOrder: CreditOrder = {
  ...draft,
  comandaId: 'comanda-open',
  comandaNumber: 43,
  finalizedAt: '2026-07-28T18:10:00.000Z',
  id: 'open-id',
  source: 'TABLE',
  status: 'OPEN',
  tableNumber: 4,
  totalCents: 2198,
};
const customer: CreditCustomerDetails = {
  balanceCents: 2198,
  draftOrderCount: 1,
  id: 'customer-id',
  name: 'Maria',
  openOrderCount: 1,
  orders: [draft, openOrder],
  settlements: [],
};

it('shows order origins and resumes a manual draft', async () => {
  const onViewOrder = jest.fn();

  render(
    <CreditCustomerDetailsScreen
      apiBaseUrl="http://localhost:3333"
      customerId="customer-id"
      loadRequest={() => Promise.resolve(customer)}
      onBack={jest.fn()}
      onNewCredit={jest.fn()}
      onViewOrder={onViewOrder}
    />,
  );

  expect(await screen.findByText('Maria')).toBeTruthy();
  expect(screen.getByText('Saldo R$ 21,98')).toBeTruthy();
  expect(screen.getByText('Lançamento manual')).toBeTruthy();
  expect(screen.getByText('Mesa 4')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Retomar rascunho' }));
  expect(onViewOrder).toHaveBeenCalledWith(draft);
  expect(
    screen.getByRole('button', { name: 'Quitar este fiado (R$ 21,98)' }),
  ).toBeTruthy();
});

it('filters open and settled orders without showing cancelled records', async () => {
  const settledOrder: CreditOrder = {
    ...openOrder,
    settledAt: '2026-07-28T20:00:00.000Z',
    status: 'SETTLED',
  };

  render(
    <CreditCustomerDetailsScreen
      apiBaseUrl="http://localhost:3333"
      customerId="customer-id"
      loadRequest={() =>
        Promise.resolve({
          ...customer,
          balanceCents: 0,
          openOrderCount: 0,
          orders: [draft, settledOrder],
        })
      }
      onBack={jest.fn()}
      onNewCredit={jest.fn()}
      onViewOrder={jest.fn()}
    />,
  );

  expect(await screen.findByText('Saldo R$ 0,00')).toBeTruthy();
  expect(screen.queryByText('Quitado')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Quitados' }));
  expect(await screen.findByText('Quitado')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Visualizar comanda' })).toBeTruthy();
  expect(screen.queryByText('Rascunho')).toBeNull();
});
