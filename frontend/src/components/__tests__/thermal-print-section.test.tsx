import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { ComandaPrintDocument } from '../../services/comanda-print-api';
import { defaultPrinterSettings } from '../../services/printer-settings';
import { ThermalPrintSection } from '../thermal-print-section';

const document: ComandaPrintDocument = {
  comandaId: 'comanda-id',
  comandaName: 'João',
  comandaNumber: 42,
  deliveryFeeCents: null,
  destination: 'TABLE',
  establishmentName: 'Destiny Bistro',
  generatedAt: '2026-09-03T18:30:00.000Z',
  generatedBy: 'Operador',
  items: [{
    additionals: [],
    productName: 'X-Burger',
    quantity: 1,
    subtotalCents: 2000,
    unitPriceCents: 2000,
  }],
  kind: 'CONFIRMED',
  openedAt: '2026-09-03T18:00:00.000Z',
  status: 'OPEN',
  tableNumber: 1,
  totalCents: 2000,
};

const loadSettings = () => Promise.resolve(defaultPrinterSettings);

it('offers a checkout bill without kitchen printing and sends the selected server snapshot', async () => {
  const preview = { includeServiceFee: false, expectedSnapshot: 'a'.repeat(64) };
  const loadDocument = jest.fn(async () => ({ ...document, kind: 'CHECKOUT_PREVIEW' as const }));
  const sendPrint = jest.fn(async () => 100), onPrinted = jest.fn();
  render(<ThermalPrintSection apiBaseUrl="http://localhost:3333" canPrint comandaId="comanda-id" platform="android"
    checkoutPreview={preview} loadDocument={loadDocument} loadSettings={loadSettings} sendPrint={sendPrint} onPrinted={onPrinted} />);
  expect(screen.queryByText('Imprimir cozinha')).toBeNull();
  fireEvent.press(screen.getByText('Imprimir conta'));
  await screen.findByText('Prévia da impressão');
  expect(loadDocument).toHaveBeenCalledWith('http://localhost:3333', 'comanda-id', 'CHECKOUT_PREVIEW', preview);
  expect(sendPrint).not.toHaveBeenCalled(); expect(onPrinted).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Enviar à impressora'));
  await waitFor(() => expect(onPrinted).toHaveBeenCalledTimes(1));
});

it('hides mobile print controls on web and without permission', () => {
  const props = {
    apiBaseUrl: 'http://localhost:3333',
    comandaId: 'comanda-id',
    loadSettings,
  };
  const { rerender } = render(
    <ThermalPrintSection {...props} canPrint={false} platform="android" />,
  );
  expect(screen.queryByTestId('thermal-print-section')).toBeNull();
  rerender(<ThermalPrintSection {...props} canPrint platform="web" />);
  expect(screen.queryByTestId('thermal-print-section')).toBeNull();
});

it('opens a black and white preview and sends confirmed ESC/POS bytes', async () => {
  const loadDocument = jest.fn().mockResolvedValue(document);
  const sendPrint = jest.fn().mockResolvedValue(100);
  render(
    <ThermalPrintSection
      apiBaseUrl="http://localhost:3333"
      canPrint
      comandaId="comanda-id"
      loadDocument={loadDocument}
      loadSettings={loadSettings}
      platform="android"
      sendPrint={sendPrint}
    />,
  );

  fireEvent.press(screen.getByText('Imprimir comanda'));
  expect(await screen.findByText('Prévia da impressão')).toBeTruthy();
  expect(loadDocument).toHaveBeenCalledWith(
    'http://localhost:3333',
    'comanda-id',
    'CONFIRMED',
  );
  const preview = screen.getByTestId('thermal-paper-preview');
  expect(StyleSheet.flatten(preview.props.style)).toEqual(
    expect.objectContaining({ backgroundColor: '#ffffff', color: '#000000' }),
  );

  fireEvent.press(screen.getByText('Enviar à impressora'));
  await waitFor(() => expect(sendPrint).toHaveBeenCalled());
  expect(sendPrint.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
  expect(sendPrint.mock.calls[0][1]).toEqual(defaultPrinterSettings);
  expect(await screen.findByText(/Enviado à impressora/)).toBeTruthy();
});

it('shows the kitchen empty state without changing the comanda', async () => {
  render(
    <ThermalPrintSection
      apiBaseUrl="http://localhost:3333"
      canPrint
      comandaId="comanda-id"
      loadDocument={() => Promise.reject(new Error('Não há itens pendentes de cozinha para imprimir.'))}
      loadSettings={loadSettings}
      platform="ios"
    />,
  );
  fireEvent.press(screen.getByText('Imprimir cozinha'));
  expect(await screen.findByText('Não há itens pendentes de cozinha para imprimir.')).toBeTruthy();
});


const pendingCounter = { name: 'João', number: 42, status: 'OPEN' as const, items: [{ quantity: 3, confirmedQuantity: 1 }] };
const deliveredCounter = { name: 'João', number: 42, status: 'OPEN' as const, items: [{ quantity: 3, confirmedQuantity: 3 }] };
const counterProps = { apiBaseUrl: 'http://localhost:3333', canPrint: true, comandaId: 'comanda-id', platform: 'android', loadSettings };

it('updates counter actions as pending items are delivered, removed or added after a final', async () => {
  const loadDocument = jest.fn();
  const { rerender } = render(<ThermalPrintSection {...counterProps} counterSale={pendingCounter} loadDocument={loadDocument} />);
  expect(screen.getByRole('button', { name: 'Imprimir pendentes para o cliente' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Imprimir conferência final para o cliente' }));
  expect(loadDocument).not.toHaveBeenCalled();
  expect(screen.getByText('Entregue ou cancele os itens pendentes para emitir a conferência final.')).toBeTruthy();
  rerender(<ThermalPrintSection {...counterProps} counterSale={deliveredCounter} loadDocument={loadDocument} />);
  expect(screen.queryByText('Imprimir pendentes para o cliente')).toBeNull();
  rerender(<ThermalPrintSection {...counterProps} counterSale={pendingCounter} loadDocument={loadDocument} />);
  expect(screen.getByText('Imprimir pendentes para o cliente')).toBeTruthy();
  rerender(<ThermalPrintSection {...counterProps} counterSale={{ name: null, number: 42, status: 'OPEN', items: [] }} loadDocument={loadDocument} />);
  fireEvent.press(screen.getByText('Imprimir conferência final para o cliente'));
  expect(loadDocument).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('Imprimir pendentes para o cliente')).toBeNull());
});

it('retries the same counter snapshot after a printer failure without marking payment or delivery', async () => {
  const target = { ...document, kind: 'COUNTER_PENDING' as const, destination: 'COUNTER' as const, tableNumber: null };
  const loadDocument = jest.fn().mockResolvedValue(target);
  const sendPrint = jest.fn().mockRejectedValueOnce(new Error('Impressora offline')).mockResolvedValue(100);
  const onPrinted = jest.fn();
  render(<ThermalPrintSection {...counterProps} counterSale={pendingCounter} loadDocument={loadDocument} sendPrint={sendPrint} onPrinted={onPrinted} />);
  fireEvent.press(screen.getByText('Imprimir pendentes para o cliente'));
  await screen.findByText('Prévia da impressão');
  expect(loadDocument).toHaveBeenCalledWith('http://localhost:3333', 'comanda-id', 'COUNTER_PENDING');
  fireEvent.press(screen.getByText('Enviar à impressora'));
  await screen.findAllByText('Impressora offline');
  fireEvent.press(screen.getByText('Enviar à impressora'));
  await screen.findByText(/Enviado à impressora/);
  expect(sendPrint).toHaveBeenCalledTimes(2);
  expect(sendPrint.mock.calls[1][0]).toEqual(sendPrint.mock.calls[0][0]);
  expect(loadDocument).toHaveBeenCalledTimes(1);
  expect(onPrinted).not.toHaveBeenCalled();
  expect(screen.getByText('Imprimir pendentes para o cliente')).toBeTruthy();
});

it('cancels the counter preview without sending and loads final only when every item is delivered', async () => {
  const loadDocument = jest.fn().mockResolvedValue({ ...document, kind: 'COUNTER_FINAL', destination: 'COUNTER', tableNumber: null });
  const sendPrint = jest.fn();
  render(<ThermalPrintSection {...counterProps} counterSale={deliveredCounter} loadDocument={loadDocument} sendPrint={sendPrint} />);
  fireEvent.press(screen.getByText('Imprimir conferência final para o cliente'));
  await screen.findByText('Prévia da impressão');
  expect(loadDocument).toHaveBeenCalledWith('http://localhost:3333', 'comanda-id', 'COUNTER_FINAL');
  fireEvent.press(screen.getAllByText('Cancelar')[0]);
  expect(sendPrint).not.toHaveBeenCalled();
});


it('discards a counter preview when a new order changes the loaded sale', async () => {
  const loadDocument = jest.fn().mockResolvedValue({ ...document, kind: 'COUNTER_FINAL', destination: 'COUNTER', tableNumber: null });
  const { rerender } = render(<ThermalPrintSection {...counterProps} counterSale={deliveredCounter} loadDocument={loadDocument} />);
  fireEvent.press(screen.getByText('Imprimir conferência final para o cliente'));
  await screen.findByText('Prévia da impressão');
  rerender(<ThermalPrintSection {...counterProps} counterSale={pendingCounter} loadDocument={loadDocument} />);
  await waitFor(() => expect(screen.queryByText('Prévia da impressão')).toBeNull());
  expect(screen.getByText('Imprimir pendentes para o cliente')).toBeTruthy();
});


it.each([
  ['COUNTER_PENDING', 'CLIENT', 'Imprimir pendentes para o cliente'],
  ['COUNTER_PENDING', 'COUNTER', 'Imprimir pendentes para o balcão'],
  ['COUNTER_FINAL', 'CLIENT', 'Imprimir conferência final para o cliente'],
  ['COUNTER_FINAL', 'COUNTER', 'Imprimir conferência final para o balcão'],
] as const)('prints exactly one %s copy for %s, identified by customer, number and counter', async (kind, recipient, label) => {
  const loadDocument = jest.fn().mockResolvedValue({ ...document, kind, destination: 'COUNTER', tableNumber: null });
  const sendPrint = jest.fn().mockResolvedValue(100);
  render(<ThermalPrintSection {...counterProps} counterSale={kind === 'COUNTER_PENDING' ? pendingCounter : deliveredCounter}
    loadDocument={loadDocument} sendPrint={sendPrint} />);
  const button = screen.getByRole('button', { name: label });
  expect(screen.getAllByText('Balcão · Comanda #42 · João').length).toBeGreaterThanOrEqual(2);
  fireEvent.press(button);
  await screen.findByText('Prévia da impressão');
  const text = screen.getByTestId('thermal-paper-preview').props.children as string;
  expect(text.match(/COMANDA #42/g)).toHaveLength(1);
  expect(text).toContain('NOME: Joao');
  expect(text).toContain('BALCAO');
  expect(text).toContain(recipient === 'CLIENT' ? 'VIA DO CLIENTE' : 'VIA DO BALCAO');
  expect(text).not.toContain(recipient === 'CLIENT' ? 'VIA DO BALCAO' : 'VIA DO CLIENTE');
  fireEvent.press(screen.getByText('Enviar à impressora'));
  await waitFor(() => expect(sendPrint).toHaveBeenCalledTimes(1));
  const bytes = Array.from(sendPrint.mock.calls[0][0] as Uint8Array);
  expect(bytes.filter((value, index) => value === 0x1d && bytes[index + 1] === 0x56 && bytes[index + 2] === 0)).toHaveLength(1);
});
