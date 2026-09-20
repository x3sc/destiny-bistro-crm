import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Comanda } from '../../services/comandas-api';
import { QuickSalesScreen } from '../quick-sales-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return { useFocusEffect: (callback: React.EffectCallback) => react.useEffect(callback, [callback]) };
});
const sale: Comanda = {
  id: 'quick-id', number: 42, name: 'Maria', table: null, tableName: 'Venda rápida',
  status: 'OPEN', openedAt: '2026-09-16T12:00:00.000Z', closedAt: null,
  cancelledAt: null, cancellationReason: null, credit: null, events: [], items: [], payments: [], totalCents: 1000,
};
it('requires a customer name, opens without a table and prevents duplicate submits', async () => {
  const openRequest = jest.fn(() => Promise.resolve(sale));
  const onSelect = jest.fn();
  render(<QuickSalesScreen apiBaseUrl="http://localhost:3333" loadRequest={async () => []} openRequest={openRequest} onBack={jest.fn()} onSelect={onSelect} />);
  await screen.findByText('Nenhuma venda rápida em aberto.');
  fireEvent.press(screen.getByRole('button', { name: 'Abrir venda rápida' }));
  expect(openRequest).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Nome do cliente'), '  Maria  ');
  fireEvent.press(screen.getByRole('button', { name: 'Abrir venda rápida' }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(sale));
  expect(openRequest).toHaveBeenCalledTimes(1);
  expect(openRequest).toHaveBeenCalledWith('http://localhost:3333', 'Maria');
});
it('resumes an open sale by customer name without opening another', async () => {
  const onSelect = jest.fn();
  render(<QuickSalesScreen apiBaseUrl="http://localhost:3333" loadRequest={async () => [sale]} onBack={jest.fn()} onSelect={onSelect} canWrite={false} />);
  fireEvent.press(await screen.findByRole('button', { name: 'Comanda 42, Maria' }));
  expect(onSelect).toHaveBeenCalledWith(sale);
  expect(screen.queryByLabelText('Nome do cliente')).toBeNull();
});
it('preserves the customer name when opening fails', async () => {
  render(<QuickSalesScreen apiBaseUrl="http://localhost:3333" loadRequest={async () => []} openRequest={async () => { throw new Error('offline'); }} onBack={jest.fn()} onSelect={jest.fn()} />);
  await screen.findByText('Nenhuma venda rápida em aberto.');
  fireEvent.changeText(screen.getByLabelText('Nome do cliente'), 'Maria');
  fireEvent.press(screen.getByRole('button', { name: 'Abrir venda rápida' }));
  expect(await screen.findByText('Não foi possível abrir a venda rápida.')).toBeTruthy();
  expect(screen.getByDisplayValue('Maria')).toBeTruthy();
});
