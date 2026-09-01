import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import { themeColors } from '../../theme/tokens';
import { OpenComandaScreen } from '../open-comanda-screen';

const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [],
  id: 'comanda-id',
  items: [],
  name: 'João',
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

it('opens a comanda after explicit confirmation', async () => {
  const onBack = jest.fn();
  const onOpened = jest.fn();
  const openRequest = jest.fn(() => Promise.resolve(comanda));

  render(
    <OpenComandaScreen
      apiBaseUrl="http://192.168.0.10:3333"
      onBack={onBack}
      onOpened={onOpened}
      openRequest={openRequest}
      tableId={1}
      tableNumber={1}
    />,
  );

  expect(screen.getByText('Livre')).toBeTruthy();
  expect(screen.getByTestId('open-comanda-header')).toHaveStyle({
    backgroundColor: themeColors.primary,
    minHeight: 56,
  });
  expect(screen.getByTestId('open-comanda-card')).toHaveStyle({
    backgroundColor: themeColors.surfaceMuted,
  });
  expect(
    screen.getByText('Você poderá adicionar produtos depois de abrir a comanda.'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
  expect(onBack).toHaveBeenCalledTimes(1);

  fireEvent.changeText(
    screen.getByLabelText('Nome da mesa (opcional)'),
    '  João  ',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar abertura' }));

  expect(await screen.findByText('Abrindo...')).toBeTruthy();
  expect(openRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    1,
    'João',
  );
  expect(onOpened).toHaveBeenCalledWith(comanda);
});

it('shows an error when opening fails', async () => {
  const openRequest = jest.fn(() => Promise.reject(new Error('offline')));

  render(
    <OpenComandaScreen
      apiBaseUrl="http://192.168.0.10:3333"
      onBack={jest.fn()}
      onOpened={jest.fn()}
      openRequest={openRequest}
      tableId={1}
      tableNumber={1}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Confirmar abertura' }));

  expect(await screen.findByText('Não foi possível abrir a comanda.')).toBeTruthy();
});
