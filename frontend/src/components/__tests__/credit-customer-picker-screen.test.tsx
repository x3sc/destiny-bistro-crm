import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { CreditCustomerSummary } from '../../services/credits-api';
import { CreditCustomerPickerScreen } from '../credit-customer-picker-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const customer: CreditCustomerSummary = {
  balanceCents: 0,
  draftOrderCount: 0,
  id: 'customer-id',
  name: 'Maria',
  openOrderCount: 0,
};

it('selects a previously stored person including inactive customers', async () => {
  const loadRequest = jest.fn(() => Promise.resolve([customer]));
  const onSelectCustomer = jest.fn(() => Promise.resolve());

  render(
    <CreditCustomerPickerScreen
      actionLabel="Criar fiado"
      apiBaseUrl="http://localhost:3333"
      loadRequest={loadRequest}
      onBack={jest.fn()}
      onSelectCustomer={onSelectCustomer}
    />,
  );

  expect(await screen.findByText('Maria')).toBeTruthy();
  expect(loadRequest).toHaveBeenCalledWith('http://localhost:3333', true);
  fireEvent.press(screen.getByRole('button', { name: /Maria/ }));
  await waitFor(() => {
    expect(onSelectCustomer).toHaveBeenCalledWith(customer);
  });
});

it('creates a person before continuing the flow', async () => {
  const createRequest = jest.fn(() => Promise.resolve(customer));
  const onSelectCustomer = jest.fn(() => Promise.resolve());

  render(
    <CreditCustomerPickerScreen
      actionLabel="Cadastrar e criar fiado"
      apiBaseUrl="http://localhost:3333"
      createRequest={createRequest}
      loadRequest={() => Promise.resolve([])}
      onBack={jest.fn()}
      onSelectCustomer={onSelectCustomer}
    />,
  );

  fireEvent.changeText(screen.getByLabelText('Nome da pessoa'), '  Maria  ');
  fireEvent.press(
    screen.getByRole('button', { name: 'Cadastrar e criar fiado' }),
  );

  await waitFor(() => {
    expect(createRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      'Maria',
    );
    expect(onSelectCustomer).toHaveBeenCalledWith(customer);
  });
});
