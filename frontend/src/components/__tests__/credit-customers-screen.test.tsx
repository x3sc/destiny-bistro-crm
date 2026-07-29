import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CreditCustomerSummary } from '../../services/credits-api';
import { CreditCustomersScreen } from '../credit-customers-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const customers: CreditCustomerSummary[] = [
  {
    balanceCents: 3297,
    draftOrderCount: 1,
    id: 'customer-id',
    name: 'Maria',
    openOrderCount: 2,
  },
];

it('shows grouped balance and opens the selected customer', async () => {
  const onSelectCustomer = jest.fn();

  render(
    <CreditCustomersScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={() => Promise.resolve(customers)}
      onBack={jest.fn()}
      onNewCredit={jest.fn()}
      onSelectCustomer={onSelectCustomer}
    />,
  );

  expect(await screen.findByText('Maria')).toBeTruthy();
  expect(screen.getByText('R$ 32,97')).toBeTruthy();
  expect(screen.getByText('2 pedidos abertos')).toBeTruthy();
  expect(screen.getByText('1 rascunho')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: /Maria/ }));
  expect(onSelectCustomer).toHaveBeenCalledWith(customers[0]);
});

it('starts a new credit from the empty state', async () => {
  const onNewCredit = jest.fn();

  render(
    <CreditCustomersScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={() => Promise.resolve([])}
      onBack={jest.fn()}
      onNewCredit={onNewCredit}
      onSelectCustomer={jest.fn()}
    />,
  );

  expect(
    await screen.findByText('Nenhum saldo ou rascunho de fiado no momento.'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Novo fiado' }));
  expect(onNewCredit).toHaveBeenCalledTimes(1);
});
