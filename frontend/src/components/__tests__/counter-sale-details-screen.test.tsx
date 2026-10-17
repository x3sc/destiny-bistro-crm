import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CounterSaleDetailsScreen } from '../counter-sale-details-screen';
import type { Comanda } from '../../services/comandas-api';

const mockSale: Comanda = { id: 'counter', name: null, number: 12, table: null, tableName: 'Balcão', status: 'OPEN',
  counterSnapshot: 'a'.repeat(64),
  openedAt: '2026-10-16T12:00:00.000Z', closedAt: null, cancelledAt: null, cancellationReason: null,
  credit: null, payments: [], events: [], totalCents: 500,
  items: [{ id: 'item', productId: 'p', productName: 'Café', quantity: 1, confirmedQuantity: 1, unitPriceCents: 500, subtotalCents: 500, createdAt: '2026-10-16T12:00:00Z' }] };
jest.mock('../comanda-details-screen', () => {
  const { Button, View } = jest.requireActual('react-native');
  return { ComandaDetailsScreen: ({ onCheckout, onEditCounterName }: { onCheckout: (sale: Comanda) => void; onEditCounterName: (sale: Comanda) => void }) =>
    <View><Button title="Concluir venda" onPress={() => onCheckout(mockSale)} /><Button title="Identificação opcional" onPress={() => onEditCounterName(mockSale)} /></View> };
});

it('asks for explicit external payment confirmation and reuses the same key after failure', async () => {
  const complete = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ...mockSale, status: 'CLOSED' });
  const onFinished = jest.fn();
  render(<CounterSaleDetailsScreen apiBaseUrl="http://localhost:3333" comandaId="counter" canWrite
    completeRequest={complete} onFinished={onFinished} onBack={jest.fn()} onAddProducts={jest.fn()} />);
  fireEvent.press(screen.getByRole('button', { name: 'Concluir venda' }));
  expect(screen.getByText(/O recebimento ocorre no caixa externo/)).toBeTruthy();
  expect(complete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar venda paga no Balcão' }));
  expect(await screen.findByText(/Não foi possível concluir/)).toBeTruthy();
  const confirm = screen.getByRole('button', { name: 'Confirmar venda paga no Balcão' });
  act(() => { fireEvent.press(confirm); fireEvent.press(confirm); });
  await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  expect(complete).toHaveBeenCalledTimes(2);
  expect(complete.mock.calls[0]).toEqual(['http://localhost:3333', 'counter', expect.any(String), 'a'.repeat(64)]);
  expect(complete.mock.calls[0][2]).toBe(complete.mock.calls[1][2]);
});

it('does not send payment when external confirmation is cancelled', () => {
  const complete = jest.fn();
  render(<CounterSaleDetailsScreen apiBaseUrl="http://localhost:3333" comandaId="counter" canWrite
    completeRequest={complete} onFinished={jest.fn()} onBack={jest.fn()} onAddProducts={jest.fn()} />);
  fireEvent.press(screen.getByRole('button', { name: 'Concluir venda' }));
  fireEvent.press(screen.getByRole('button', { name: 'Voltar à comanda' }));
  expect(complete).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Confirmar venda paga no Balcão' })).toBeNull();
});
