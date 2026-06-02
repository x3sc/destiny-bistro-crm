import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import { ComandaDetailsScreen } from '../comanda-details-screen';

const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  events: [],
  id: 'comanda-id',
  number: 42,
  openedAt: '2026-06-02T19:00:00.000Z',
  status: 'OPEN',
  table: {
    id: 1,
    number: 1,
  },
};

it('shows comanda details', async () => {
  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comanda)}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  expect(await screen.findByText('Comanda #42')).toBeTruthy();
  expect(screen.getByText('Mesa 1')).toBeTruthy();
  expect(screen.getByText('Status: Aberta')).toBeTruthy();
});

it('cancels a comanda only after explicit confirmation', async () => {
  const cancelRequest = jest.fn(() => Promise.resolve(comanda));
  const onCancelled = jest.fn();

  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      cancelRequest={cancelRequest}
      comandaId="comanda-id"
      loadRequest={() => Promise.resolve(comanda)}
      onBack={jest.fn()}
      onCancelled={onCancelled}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Cancelar comanda vazia' }));
  expect(cancelRequest).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

  expect(await screen.findByText('Cancelando...')).toBeTruthy();
  expect(cancelRequest).toHaveBeenCalledWith('http://192.168.0.10:3333', 'comanda-id');
  expect(onCancelled).toHaveBeenCalled();
});

it('shows an error when loading fails', async () => {
  render(
    <ComandaDetailsScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadRequest={() => Promise.reject(new Error('offline'))}
      onBack={jest.fn()}
      onCancelled={jest.fn()}
    />,
  );

  expect(await screen.findByText('Não foi possível carregar a comanda.')).toBeTruthy();
});
