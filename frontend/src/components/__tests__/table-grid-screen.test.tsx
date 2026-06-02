import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RestaurantTable } from '../../services/tables-api';
import { TableGridScreen } from '../table-grid-screen';

const tables: RestaurantTable[] = [
  { id: 1, number: 1, status: 'FREE' },
  { id: 2, number: 2, status: 'OPEN' },
  { id: 3, number: 3, status: 'AWAITING_CHECK' },
];

it('shows a configuration error when the API URL is absent', () => {
  const loadTables = jest.fn();

  render(<TableGridScreen apiBaseUrl="" loadTablesRequest={loadTables} />);

  expect(
    screen.getByText('Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo.'),
  ).toBeTruthy();
  expect(loadTables).not.toHaveBeenCalled();
});

it('shows loading while the tables request is pending', () => {
  const loadTables = jest.fn(() => new Promise<RestaurantTable[]>(() => undefined));

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={loadTables}
    />,
  );

  expect(screen.getByText('Carregando mesas...')).toBeTruthy();
});

it('shows the restaurant table grid with translated statuses', async () => {
  const loadTables = jest.fn(() => Promise.resolve(tables));

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333/"
      loadTablesRequest={loadTables}
    />,
  );

  expect(await screen.findByText('Mesa 1')).toBeTruthy();
  expect(screen.getByText('Livre')).toBeTruthy();
  expect(screen.getByText('Aberta')).toBeTruthy();
  expect(screen.getByText('Aguardando caixa')).toBeTruthy();
  expect(loadTables).toHaveBeenCalledWith('http://192.168.0.10:3333');
});

it('shows an empty state when no restaurant table exists', async () => {
  const loadTables = jest.fn(() => Promise.resolve([]));

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={loadTables}
    />,
  );

  expect(await screen.findByText('Nenhuma mesa cadastrada.')).toBeTruthy();
});

it('shows an unavailable state when the API request fails', async () => {
  const loadTables = jest.fn(() => Promise.reject(new Error('offline')));

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={loadTables}
    />,
  );

  expect(await screen.findByText('Não foi possível carregar as mesas.')).toBeTruthy();
});

it('retries loading tables after a failure', async () => {
  const loadTables = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(tables);

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={loadTables}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }));

  expect(await screen.findByText('Mesa 1')).toBeTruthy();
  expect(loadTables).toHaveBeenCalledTimes(2);
});
