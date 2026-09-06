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
