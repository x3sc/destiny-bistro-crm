import type { ComandaPrintDocument } from './comanda-print-api';

export const THERMAL_COLUMNS = 48;
const ESC = 0x1b;
const GS = 0x1d;

export function buildThermalReceiptLines(document: ComandaPrintDocument) {
  const lines: string[] = [
    normalizeText(document.establishmentName.toUpperCase()),
    document.kind === 'CONFIRMED' ? 'VIA DA COMANDA' : 'COZINHA',
    '-'.repeat(THERMAL_COLUMNS),
    `COMANDA #${document.comandaNumber}`,
    destinationLabel(document),
  ];

  if (document.comandaName) {
    lines.push(...wrapLine(`NOME: ${normalizeText(document.comandaName)}`));
  }
  lines.push(`EMITIDO: ${formatDateTime(document.generatedAt)}`);
  lines.push('-'.repeat(THERMAL_COLUMNS));

  for (const item of document.items) {
    lines.push(...wrapLine(`${item.quantity} x ${normalizeText(item.productName)}`));
    for (const additional of item.additionals) {
      lines.push(
        ...wrapLine(`  + ${additional.quantityPerUnit} por un. ${normalizeText(additional.name)}`),
      );
    }
    if (document.kind === 'CONFIRMED') {
      lines.push(
        columns(
          `UN. ${formatCents(item.unitPriceCents ?? 0)}`,
          formatCents(item.subtotalCents ?? 0),
        ),
      );
    }
    lines.push('');
  }

  lines.push('-'.repeat(THERMAL_COLUMNS));
  if (document.kind === 'CONFIRMED') {
    const itemsTotal = document.items.reduce(
      (total, item) => total + (item.subtotalCents ?? 0),
      0,
    );
    lines.push(columns('SUBTOTAL CONFIRMADO', formatCents(itemsTotal)));
    if (document.deliveryFeeCents !== null) {
      lines.push(columns('TAXA DE ENTREGA', formatCents(document.deliveryFeeCents)));
    }
    lines.push(columns('TOTAL', formatCents(document.totalCents ?? itemsTotal)));
  } else {
    lines.push('SOMENTE ITENS PENDENTES DE PREPARO');
  }
  lines.push('-'.repeat(THERMAL_COLUMNS));
  lines.push(...wrapLine(`OPERADOR: ${normalizeText(document.generatedBy)}`));
  return lines;
}

export function buildThermalReceiptBytes(document: ComandaPrintDocument) {
  const body = buildThermalReceiptLines(document).join('\n');
  return Uint8Array.from([
    ESC,
    0x40,
    ESC,
    0x74,
    0x03,
    ...asciiBytes(body),
    0x0a,
    ESC,
    0x64,
    0x04,
    GS,
    0x56,
    0x00,
  ]);
}

export function thermalReceiptPreview(document: ComandaPrintDocument) {
  return buildThermalReceiptLines(document).join('\n');
}

function destinationLabel(document: ComandaPrintDocument) {
  if (document.destination === 'TABLE') return `MESA ${document.tableNumber}`;
  if (document.destination === 'DELIVERY') return 'DELIVERY';
  return 'BALCAO';
}

function columns(left: string, right: string) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  const available = Math.max(1, THERMAL_COLUMNS - normalizedRight.length - 1);
  const clippedLeft = normalizedLeft.slice(0, available);
  return `${clippedLeft}${' '.repeat(THERMAL_COLUMNS - clippedLeft.length - normalizedRight.length)}${normalizedRight}`;
}

function wrapLine(value: string) {
  const normalized = normalizeText(value).trimEnd();
  if (!normalized) return [''];
  const lines: string[] = [];
  let remaining = normalized;
  while (remaining.length > THERMAL_COLUMNS) {
    const slice = remaining.slice(0, THERMAL_COLUMNS + 1);
    const breakAt = slice.lastIndexOf(' ');
    const position = breakAt > 0 ? breakAt : THERMAL_COLUMNS;
    lines.push(remaining.slice(0, position).trimEnd());
    remaining = remaining.slice(position).trimStart();
  }
  lines.push(remaining);
  return lines;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\x20-\x7E]/gu, '?');
}

function asciiBytes(value: string) {
  return Array.from(value, (character) => character.charCodeAt(0));
}

function formatCents(value: number) {
  const absolute = Math.abs(value);
  const amount = `${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
  return `${value < 0 ? '-' : ''}R$ ${amount}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
