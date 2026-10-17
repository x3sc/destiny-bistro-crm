import type { ComandaPrintDocument } from '../comanda-print-api';
import {
  buildThermalReceiptBytes,
  thermalReceiptPreview,
  THERMAL_COLUMNS,
} from '../thermal-receipt';

const confirmedDocument: ComandaPrintDocument = {
  comandaId: 'comanda-id',
  comandaName: 'João',
  comandaNumber: 42,
  deliveryFeeCents: null,
  destination: 'TABLE',
  establishmentName: 'Destiny Bistrô',
  generatedAt: '2026-09-03T18:30:00.000Z',
  generatedBy: 'Operador',
  items: [
    {
      additionals: [{ name: 'Bacon', quantityPerUnit: 2, unitPriceCents: 300 }],
      productName: 'X-Burger artesanal muito grande com nome longo',
      quantity: 2,
      subtotalCents: 5_200,
      unitPriceCents: 2_600,
    },
  ],
  kind: 'CONFIRMED',
  openedAt: '2026-09-03T18:00:00.000Z',
  status: 'OPEN',
  tableNumber: 7,
  totalCents: 5_200,
};

it('renders an 80 mm monochrome confirmed receipt', () => {
  const preview = thermalReceiptPreview(confirmedDocument);
  expect(preview).toContain('DESTINY BISTRO');
  expect(preview).toContain('VIA DA COMANDA');
  expect(preview).toContain('MESA 7');
  expect(preview).toContain('2 x X-Burger');
  expect(preview).toContain('TOTAL');
  expect(preview).toContain('R$ 52,00');
  expect(preview).not.toMatch(/[^\x0A\x20-\x7E]/u);
  expect(preview.split('\n').every((line) => line.length <= THERMAL_COLUMNS)).toBe(true);
});

it('prints the chosen optional fee on a pending bill and only persisted fees on the final receipt', () => {
  const withFee = { ...confirmedDocument, kind: 'CHECKOUT_PREVIEW' as const, totalCents: 5720,
    serviceFee: { included: true, percent: 10, subtotalCents: 5200, amountCents: 520 } };
  const preview = thermalReceiptPreview(withFee);
  expect(preview).toContain('CONTA PARA CONFERENCIA'); expect(preview).toContain('PAGAMENTO PENDENTE');
  expect(preview).toContain('TAXA DE SERVICO (10%)'); expect(preview).toContain('R$ 57,20');
  const withoutFee = thermalReceiptPreview({ ...withFee, totalCents: 5200,
    serviceFee: { included: false, percent: 0, subtotalCents: 5200, amountCents: 0 } });
  expect(withoutFee).toContain('TAXA DE SERVICO DISPENSADA'); expect(withoutFee).toContain('R$ 52,00');
  const final = thermalReceiptPreview({ ...withFee, kind: 'CONFIRMED', status: 'CLOSED' });
  expect(final).toContain('COMANDA FECHADA'); expect(final).not.toContain('PAGAMENTO PENDENTE');
  expect(final).toContain('R$ 57,20');
});

it('identifies external Balcão payment only on completed receipts', () => {
  const preview = thermalReceiptPreview({ ...confirmedDocument, destination: 'COUNTER', tableNumber: null,
    status: 'CLOSED', externalPaymentMethod: 'COUNTER' });
  expect(preview).toContain('PAGAMENTO: BALCAO (CAIXA EXTERNO)');
});

it('renders kitchen pending items without prices', () => {
  const preview = thermalReceiptPreview({
    ...confirmedDocument,
    deliveryFeeCents: null,
    items: confirmedDocument.items.map((item) => ({
      ...item,
      subtotalCents: null,
      unitPriceCents: null,
      additionals: item.additionals.map((additional) => ({
        ...additional,
        unitPriceCents: null,
      })),
    })),
    kind: 'KITCHEN_PENDING',
    totalCents: null,
  });
  expect(preview).toContain('COZINHA');
  expect(preview).toContain('SOMENTE ITENS PENDENTES DE PREPARO');
  expect(preview).not.toContain('R$');
});

it('emits initialize, feed and full-cut ESC/POS commands', () => {
  const bytes = buildThermalReceiptBytes(confirmedDocument);
  expect(Array.from(bytes.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x03]);
  expect(Array.from(bytes.slice(-7))).toEqual([0x0a, 0x1b, 0x64, 0x04, 0x1d, 0x56, 0x00]);
});

it('identifies a quick sale and its customer without printing a table number', () => {
  const preview = thermalReceiptPreview({ ...confirmedDocument, destination: 'QUICK_SALE', tableNumber: null, comandaName: 'Maria' });
  expect(preview).toContain('VENDA RAPIDA');
  expect(preview).toContain('NOME: Maria');
  expect(preview).not.toContain('MESA');
  expect(preview).not.toMatch(/[^\x0A\x20-\x7E]/u);
});


it.each(['COUNTER_PENDING', 'COUNTER_FINAL'] as const)('renders two labeled copies from the same %s snapshot with two cuts', (kind) => {
  const document = { ...confirmedDocument, kind, destination: 'COUNTER' as const, tableNumber: null };
  const preview = thermalReceiptPreview(document);
  expect(preview.match(/COMANDA #42/g)).toHaveLength(2);
  expect(preview.match(/2 x X-Burger/g)).toHaveLength(2);
  expect(preview.match(/EMITIDO:/g)).toHaveLength(2);
  expect(preview.match(/NAO COMPROVA PAGAMENTO/g)).toHaveLength(2);
  expect(preview).toContain('VIA DO CLIENTE');
  expect(preview).toContain('VIA DO BALCAO');
  expect(preview).toContain('R$ 52,00');
  expect(preview.split('\n').every((line) => line.length <= THERMAL_COLUMNS)).toBe(true);
  const bytes = Array.from(buildThermalReceiptBytes(document));
  expect(bytes.filter((value, index) => value === 0x1d && bytes[index + 1] === 0x56 && bytes[index + 2] === 0)).toHaveLength(2);
  expect(preview).toContain(kind === 'COUNTER_PENDING' ? 'PEDIDO PENDENTE DE ENTREGA' : 'CONFERENCIA FINAL');
  if (kind === 'COUNTER_FINAL') {
    expect(preview).toContain('APRESENTAR AO CAIXA');
    expect(preview.match(/SUBSTITUI A CONFERENCIA ANTERIOR/g)).toHaveLength(2);
  } else {
    expect(preview).toContain('SUBTOTAL PENDENTE');
    expect(preview).not.toContain('SUBTOTAL CONFIRMADO');
  }
});


it.each([
  ['COUNTER_PENDING', 'CLIENT'], ['COUNTER_PENDING', 'COUNTER'],
  ['COUNTER_FINAL', 'CLIENT'], ['COUNTER_FINAL', 'COUNTER'],
] as const)('selects one %s receipt for %s, preserving identification and values', (kind, recipient) => {
  const document = { ...confirmedDocument, kind, destination: 'COUNTER' as const, tableNumber: null };
  const preview = thermalReceiptPreview(document, recipient);
  expect(preview.match(/COMANDA #42/g)).toHaveLength(1);
  expect(preview.match(/NOME: Joao/g)).toHaveLength(1);
  expect(preview).toContain('BALCAO');
  expect(preview).toContain('R$ 52,00');
  expect(preview).toContain(recipient === 'CLIENT' ? 'VIA DO CLIENTE' : 'VIA DO BALCAO');
  expect(preview).not.toContain(recipient === 'CLIENT' ? 'VIA DO BALCAO' : 'VIA DO CLIENTE');
  const bytes = Array.from(buildThermalReceiptBytes(document, recipient));
  expect(bytes.filter((value, index) => value === 0x1d && bytes[index + 1] === 0x56 && bytes[index + 2] === 0)).toHaveLength(1);
});
