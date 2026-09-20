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
