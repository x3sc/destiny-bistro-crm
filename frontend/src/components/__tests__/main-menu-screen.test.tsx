import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { OperationalMainMenuScreen as MainMenuScreen } from '../operational-main-menu-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

it('navigates to tables, credits, delivery and administration', () => {
  const onAdmin = jest.fn();
  const onCredits = jest.fn();
  const onDeliveries = jest.fn();
  const onKitchen = jest.fn();
  const onTables = jest.fn();
  const onQuickSales = jest.fn();
  const onCounterSales = jest.fn();

  render(
    <MainMenuScreen
      onAdmin={onAdmin}
      onCredits={onCredits}
      onDeliveries={onDeliveries}
      onKitchen={onKitchen}
      onTables={onTables}
      canAccessQuickSales
      canAccessCounterSales
      onCounterSales={onCounterSales}
      onQuickSales={onQuickSales}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mesas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fiados' }));
  fireEvent.press(screen.getByRole('button', { name: 'Delivery' }));
  fireEvent.press(screen.getByRole('button', { name: 'Cozinha' }));
  fireEvent.press(screen.getByRole('button', { name: 'Administrativo' }));

  fireEvent.press(screen.getByRole('button', { name: 'Venda rápida' }));
  fireEvent.press(screen.getByRole('button', { name: 'Balcão' }));
  expect(onCounterSales).toHaveBeenCalledTimes(1);
  expect(onQuickSales).toHaveBeenCalledTimes(1);
  expect(onTables).toHaveBeenCalledTimes(1);
  expect(onCredits).toHaveBeenCalledTimes(1);
  expect(onDeliveries).toHaveBeenCalledTimes(1);
  expect(onKitchen).toHaveBeenCalledTimes(1);
  expect(onAdmin).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Em breve')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
});

it('shows only permitted areas and logs out the identified user', () => {
  const onLogout = jest.fn();

  render(
    <MainMenuScreen
      canAccessCredits={false}
      canAccessAdmin={false}
      canAccessDeliveries={false}
      canAccessKitchen={false}
      canAccessTables
      establishmentName="Destiny Centro"
      onAdmin={jest.fn()}
      onCredits={jest.fn()}
      onDeliveries={jest.fn()}
      onKitchen={jest.fn()}
      onLogout={onLogout}
      onTables={jest.fn()}
      userName="Cozinha"
    />,
  );

  expect(screen.getByText('Mesas')).toBeTruthy();
  expect(screen.queryByText('Fiados')).toBeNull();
  expect(screen.queryByText('Venda rápida')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Balcão' })).toBeNull();
  expect(screen.queryByText('Delivery')).toBeNull();
  expect(screen.queryByText('Cozinha')).toBeNull();
  expect(screen.queryByText('Administrativo')).toBeNull();
  expect(
    screen.getByText('Olá, Cozinha.'),
  ).toBeTruthy();
  expect(screen.getByText('Operador conectado')).toBeTruthy();
  expect(screen.getByText('Destiny Centro')).toBeTruthy();
  fireEvent.press(screen.getByText('Sair'));
  expect(onLogout).toHaveBeenCalledTimes(1);
});

it('loads permitted Today metrics on focus and supports manual refresh', async () => {
  const loadTodayRequest = jest.fn(() =>
    Promise.resolve({
      closedSalesCents: 12_500,
      date: '2026-09-30',
      occupiedTables: 4,
      pendingKitchenTickets: null,
    }),
  );

  render(
    <MainMenuScreen
      apiBaseUrl="http://localhost:3333/"
      canAccessKitchen={false}
      canReadSales
      loadTodayRequest={loadTodayRequest}
      onAdmin={jest.fn()}
      onCredits={jest.fn()}
      onDeliveries={jest.fn()}
      onKitchen={jest.fn()}
      onTables={jest.fn()}
    />,
  );

  expect(await screen.findByText('Mesas ocupadas')).toBeTruthy();
  expect(screen.getByText('4')).toBeTruthy();
  expect(screen.getByText('Vendas fechadas')).toBeTruthy();
  expect(screen.getByText('R$ 125,00')).toBeTruthy();
  expect(screen.queryByText('Cozinha pendente')).toBeNull();
  expect(loadTodayRequest).toHaveBeenCalledTimes(1);
  expect(loadTodayRequest).toHaveBeenCalledWith('http://localhost:3333');

  fireEvent.press(
    screen.getByRole('button', { name: 'Atualizar indicadores' }),
  );
  await waitFor(() => {
    expect(loadTodayRequest).toHaveBeenCalledTimes(2);
  });
});

it('presents the Stitch operational hierarchy without duplicate quick actions', async () => {

  render(
    <MainMenuScreen
      apiBaseUrl="http://localhost:3333"
      establishmentName="Destiny Centro"
      loadTodayRequest={jest.fn(() =>
        Promise.resolve({
          closedSalesCents: null,
          date: '2026-10-02',
          occupiedTables: 2,
          pendingKitchenTickets: 3,
        }),
      )}
      onAdmin={jest.fn()}
      onCredits={jest.fn()}
      onDeliveries={jest.fn()}
      onKitchen={jest.fn()}
      onTables={jest.fn()}
      userName="Carlos"
    />,
  );

  expect(screen.getByText('Pulso do turno')).toBeTruthy();
  expect(screen.getByText('Módulos operacionais')).toBeTruthy();
  expect(screen.getByText('Destiny Bistro Experience')).toBeTruthy();
  expect(await screen.findByText('2')).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.queryByText('R$ 1.840')).toBeNull();

  expect(screen.queryByRole('button', { name: 'Abrir mesa' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir delivery' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir venda rápida' })).toBeNull();
});
