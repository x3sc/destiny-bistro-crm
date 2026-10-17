import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CounterSalesScreen } from '../counter-sales-screen';
import type { Comanda } from '../../services/comandas-api';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (callback: React.EffectCallback) => React.useEffect(callback, [callback]) };
});
const sale: Comanda = { id: 'counter', name: null, number: 12, table: null, tableName: 'Balcão', status: 'OPEN',
  openedAt: '2026-10-16T12:00:00.000Z', closedAt: null, cancelledAt: null, cancellationReason: null,
  credit: null, payments: [], events: [], items: [], totalCents: 1500 };

it('opens directly without a customer name and reuses the same key after an uncertain failure', async () => {
  const open = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(sale);
  const onOpened = jest.fn();
  render(<CounterSalesScreen apiBaseUrl="http://localhost:3333" canWrite loadRequest={async () => []}
    openRequest={open} onOpened={onOpened} onSelect={jest.fn()} onBack={jest.fn()} />);
  fireEvent.press(await screen.findByRole('button', { name: 'Nova comanda' }));
  expect(await screen.findByText('Não foi possível abrir a comanda. Tente novamente.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Nova comanda' }));
  await waitFor(() => expect(onOpened).toHaveBeenCalledWith(sale));
  expect(open.mock.calls[0][1]).toBe(open.mock.calls[1][1]);
  expect(screen.queryByLabelText('Nome do cliente')).toBeNull();
});

it('hides creation without permission, filters names, and loads completed sales only after selecting a day', async () => {
  const load = jest.fn(async () => [{ ...sale, name: 'Maria' }, { ...sale, id: 'other', number: 13, name: 'João' }]);
  render(<CounterSalesScreen apiBaseUrl="http://localhost:3333" canWrite={false} loadRequest={load}
    onOpened={jest.fn()} onSelect={jest.fn()} onBack={jest.fn()} />);
  expect(await screen.findByText('Maria')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Nova comanda' })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Buscar comanda ou cliente'), 'mari');
  expect(screen.queryByText('João')).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: 'Concluídas' }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith('http://localhost:3333', 'CLOSED', expect.any(String)));
  const count = load.mock.calls.length;
  fireEvent.changeText(screen.getByLabelText('Dia das vendas concluídas'), '2026-10-15');
  expect(load).toHaveBeenCalledTimes(count);
  fireEvent.press(screen.getByRole('button', { name: 'Consultar dia' }));
  await waitFor(() => expect(load).toHaveBeenLastCalledWith('http://localhost:3333', 'CLOSED', '2026-10-15'));
});
