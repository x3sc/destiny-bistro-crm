import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ComandaCheckoutScreen } from '../comanda-checkout-screen';
import type { Comanda } from '../../services/comandas-api';
import { CheckoutApiError } from '../../services/comandas-api';

jest.mock('expo-router', () => ({ useFocusEffect: (callback: React.EffectCallback) => {
  const React = jest.requireActual('react'); React.useEffect(callback, [callback]);
} }));
const comanda: Comanda = { id: 'sale', operationalOrigin: 'QUICK_SALE', number: 1, name: 'Cliente', table: null,
  tableName: 'Venda rápida', status: 'OPEN', credit: null, cancellationReason: null, cancelledAt: null, closedAt: null,
  openedAt: '2026-10-17T12:00:00Z', items: [], events: [], payments: [], totalCents: 10000 };
const quote = { comanda, eligible: true, canClose: true, subtotalCents: 10000, serviceFee: { percent: 10, amountCents: 1000 },
  totalWithoutServiceFeeCents: 10000, totalWithServiceFeeCents: 11000, expectedSnapshot: 'a'.repeat(64) };
it('defaults to ten percent, toggles locally and preserves an excessive entered payment while blocking close', async () => {
  const load = jest.fn(async () => quote), closeRequest = jest.fn(async () => comanda);
  render(<ComandaCheckoutScreen apiBaseUrl="http://localhost:3333" comandaId="sale"
    loadSummaryRequest={load} closeRequest={closeRequest} onBack={jest.fn()} onFinished={jest.fn()} />);
  expect(await screen.findByRole('checkbox', { name: 'Incluir taxa de serviço de 10%' })).toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Selecionar Pix no pagamento 1' }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 1'), '110,00');
  fireEvent.press(screen.getByRole('checkbox', { name: 'Incluir taxa de serviço de 10%' }));
  expect(screen.getByLabelText('Valor do pagamento 1')).toHaveDisplayValue('R$ 110,00');
  expect(screen.getByRole('button', { name: 'Confirmar e fechar mesa' })).toBeDisabled();
  expect(load).toHaveBeenCalledTimes(1); expect(closeRequest).not.toHaveBeenCalled();
});
it('sends the server snapshot and chosen fee once despite repeated taps', async () => {
  const closeRequest = jest.fn(async () => comanda), onFinished = jest.fn();
  render(<ComandaCheckoutScreen apiBaseUrl="http://localhost:3333" comandaId="sale" loadSummaryRequest={async () => quote}
    closeRequest={closeRequest} onBack={jest.fn()} onFinished={onFinished} />);
  await screen.findByRole('checkbox', { name: 'Incluir taxa de serviço de 10%' });
  fireEvent.press(screen.getByRole('button', { name: 'Selecionar Pix no pagamento 1' }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 1'), '110,00');
  const button = screen.getByRole('button', { name: 'Confirmar e fechar mesa' });
  fireEvent.press(button); fireEvent.press(button);
  await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  expect(closeRequest).toHaveBeenCalledTimes(1);
  expect(closeRequest).toHaveBeenCalledWith('http://localhost:3333', 'sale', [{ method: 'PIX', amountCents: 11000 }], undefined,
    expect.objectContaining({ includeServiceFee: true, expectedSnapshot: 'a'.repeat(64), requestId: expect.any(String) }));
});

it('keeps the same request identity after a network failure and blocks closing after a conflict until reload', async () => {
  const load = jest.fn(async () => quote);
  const closeRequest = jest.fn().mockRejectedValueOnce(new CheckoutApiError(503)).mockRejectedValueOnce(new CheckoutApiError(409));
  render(<ComandaCheckoutScreen apiBaseUrl="http://localhost:3333" comandaId="sale" loadSummaryRequest={load}
    closeRequest={closeRequest} onBack={jest.fn()} onFinished={jest.fn()} />);
  await screen.findByRole('checkbox');
  fireEvent.press(screen.getByRole('button', { name: 'Selecionar Pix no pagamento 1' }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 1'), '110,00');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar e fechar mesa' }));
  await screen.findByRole('alert');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar e fechar mesa' }));
  const reload = await screen.findByRole('button', { name: 'Recarregar conta' });
  expect(closeRequest.mock.calls[0][4]).toEqual(closeRequest.mock.calls[1][4]);
  expect(screen.getByRole('button', { name: 'Confirmar e fechar mesa' })).toBeDisabled();
  expect(screen.getByLabelText('Valor do pagamento 1')).toHaveDisplayValue('R$ 110,00');
  fireEvent.press(reload);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText('Recarregar conta')).toBeNull());
  expect(screen.getByRole('checkbox')).toBeChecked();
});
