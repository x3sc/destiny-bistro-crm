import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RestaurantTable } from '../../services/tables-api';
import { themeColors } from '../../theme/tokens';
import { getTableGridMetrics, TableGridScreen } from '../table-grid-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const tables: RestaurantTable[] = [
  { activeComanda: null, id: 1, number: 1, status: 'FREE' },
  {
    activeComanda: { id: 'comanda-id', name: 'João', number: 42 },
    id: 2,
    number: 2,
    status: 'OPEN',
  },
  { activeComanda: null, id: 3, number: 3, status: 'AWAITING_CHECK' },
];

it('adapts the table grid to the available screen width', () => {
  expect(getTableGridMetrics(320)).toEqual({ cardWidth: 288, columnCount: 1 });
  expect(getTableGridMetrics(390)).toEqual({ cardWidth: 173, columnCount: 2 });
  expect(getTableGridMetrics(680)).toEqual({ cardWidth: 318, columnCount: 2 });
  expect(getTableGridMetrics(800)).toEqual({ cardWidth: 248, columnCount: 3 });
  expect(getTableGridMetrics(1180)).toEqual({ cardWidth: 278, columnCount: 4 });
});

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
  expect(screen.getByText('• Livre')).toBeTruthy();
  expect(screen.getByText('• Ocupada')).toBeTruthy();
  expect(screen.getByText('• Aguardando pagamento')).toBeTruthy();
  expect(screen.getByText('Comanda #42')).toBeTruthy();
  expect(screen.getByText('João')).toBeTruthy();
  expect(screen.getByLabelText('Ocupadas: 1')).toBeTruthy();
  expect(screen.getByLabelText('Aguardando pagamento: 1')).toBeTruthy();
  expect(screen.getByLabelText('Livres: 1')).toBeTruthy();
  expect(screen.queryByText('Adicionar produtos')).toBeNull();
  expect(loadTables).toHaveBeenCalledWith('http://192.168.0.10:3333');
});

it('uses semantic surfaces and badges for each table status', async () => {
  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={() => Promise.resolve(tables)}
    />,
  );

  expect(await screen.findByRole('button', { name: 'Mesa 1 Livre' })).toHaveStyle({
    backgroundColor: themeColors.statusFreeSurface,
    borderColor: themeColors.statusFreeBorder,
  });
  expect(
    screen.getByRole('button', {
      name: 'Mesa 2 Ocupada João Comanda #42',
    }),
  ).toHaveStyle({
    backgroundColor: themeColors.statusOpenSurface,
    borderColor: themeColors.statusOpenBorder,
  });
  expect(
    screen.getByRole('button', { name: 'Mesa 3 Aguardando pagamento' }),
  ).toHaveStyle({
    backgroundColor: themeColors.statusAwaitingSurface,
    borderColor: themeColors.statusAwaitingBorder,
  });
  expect(screen.getByText('• Livre')).toHaveStyle({
    backgroundColor: themeColors.statusFreeBadge,
    borderColor: themeColors.statusFreeBorder,
  });
  expect(screen.getByText('• Ocupada')).toHaveStyle({
    backgroundColor: themeColors.statusOpenBadge,
    borderColor: themeColors.statusOpenBorder,
  });
  expect(screen.getByText('• Aguardando pagamento')).toHaveStyle({
    backgroundColor: themeColors.statusAwaitingBadge,
    borderColor: themeColors.statusAwaitingBorder,
  });
});

it('filters restaurant tables by operational status', async () => {
  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={() => Promise.resolve(tables)}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Livres' }));

  expect(screen.getByText('Mesa 1')).toBeTruthy();
  expect(screen.queryByText('Mesa 2')).toBeNull();
  expect(screen.queryByText('Mesa 3')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Pagamento' }));

  expect(screen.queryByText('Mesa 1')).toBeNull();
  expect(screen.queryByText('Mesa 2')).toBeNull();
  expect(screen.getByText('Mesa 3')).toBeTruthy();
});

it('keeps the table filter buttons at a stable touch size', async () => {
  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={() => Promise.resolve(tables)}
    />,
  );

  await screen.findByText('Mesa 1');

  expect(screen.getByTestId('table-filter-scroll')).toHaveStyle({
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
  });
  expect(screen.getByRole('button', { name: 'Ocupadas' })).toHaveStyle({
    flexShrink: 0,
    height: 44,
    minWidth: 88,
  });
});

it('uses large touch-friendly cards for the restaurant tables', async () => {
  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={() => Promise.resolve(tables)}
    />,
  );

  const tableCard = await screen.findByRole('button', { name: /Mesa 1 Livre/ });

  expect(tableCard).toHaveStyle({
    minHeight: 132,
    paddingHorizontal: 16,
    paddingVertical: 14,
  });
});

it('searches tables by customer name and comanda number', async () => {
  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={() => Promise.resolve(tables)}
    />,
  );

  const searchInput = await screen.findByRole('search', {
    name: 'Buscar mesa, nome ou comanda',
  });

  fireEvent.changeText(searchInput, 'joao');
  expect(screen.getByText('Mesa 2')).toBeTruthy();
  expect(screen.queryByText('Mesa 1')).toBeNull();

  fireEvent.changeText(searchInput, '42');
  expect(screen.getByText('Mesa 2')).toBeTruthy();
  expect(screen.queryByText('Mesa 3')).toBeNull();
});

it('selects a free restaurant table', async () => {
  const loadTables = jest.fn(() => Promise.resolve(tables));
  const onSelectTable = jest.fn();

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={loadTables}
      onSelectTable={onSelectTable}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Mesa 1 Livre' }));

  expect(onSelectTable).toHaveBeenCalledWith(tables[0]);
});

it('selects an occupied restaurant table', async () => {
  const loadTables = jest.fn(() => Promise.resolve(tables));
  const onSelectTable = jest.fn();

  render(
    <TableGridScreen
      apiBaseUrl="http://192.168.0.10:3333"
      loadTablesRequest={loadTables}
      onSelectTable={onSelectTable}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', {
      name: 'Mesa 2 Ocupada João Comanda #42',
    }),
  );

  expect(onSelectTable).toHaveBeenCalledWith(tables[1]);
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
