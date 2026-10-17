import type { ComandaPrintDocument } from './comanda-print-api';

export const THERMAL_COLUMNS = 48;
const ESC = 0x1b;
const GS = 0x1d;

export type CounterReceiptRecipient = 'CLIENT' | 'COUNTER';

function receiptCopies(document: ComandaPrintDocument, recipient?: CounterReceiptRecipient) {
  if (document.kind === 'COUNTER_PENDING') {
    const copies = { CLIENT: 'VIA DO CLIENTE', COUNTER: 'VIA DO BALCAO' };
    return recipient ? [copies[recipient]] : [copies.CLIENT, copies.COUNTER];
  }
  if (document.kind === 'COUNTER_FINAL') {
    const copies = { CLIENT: 'VIA DO CLIENTE - APRESENTAR AO CAIXA', COUNTER: 'VIA DO BALCAO - CONTROLE' };
    return recipient ? [copies[recipient]] : [copies.COUNTER, copies.CLIENT];
  }
  return [undefined];
}

export function buildThermalReceiptLines(document: ComandaPrintDocument, recipient?: CounterReceiptRecipient) {
  return receiptCopies(document, recipient).flatMap((copy, index) => [
    ...(index ? ['', '-'.repeat(THERMAL_COLUMNS), ''] : []),
    ...buildReceiptCopyLines(document, copy),
  ]);
}

function buildReceiptCopyLines(document: ComandaPrintDocument, copy?: string) {
  const lines: string[] = [
    normalizeText(document.establishmentName.toUpperCase()),
    document.kind === 'COUNTER_PENDING' ? 'PEDIDO PENDENTE DE ENTREGA' :
    document.kind === 'COUNTER_FINAL' ? 'CONFERENCIA FINAL' :
    document.kind === 'CHECKOUT_PREVIEW' ? 'CONTA PARA CONFERENCIA' : document.kind === 'CONFIRMED' ? 'VIA DA COMANDA' : 'COZINHA',
    '-'.repeat(THERMAL_COLUMNS),
    `COMANDA #${document.comandaNumber}`,
    destinationLabel(document),
  ];

  if (copy) lines.push(copy, 'NAO COMPROVA PAGAMENTO');
  if (document.kind === 'COUNTER_FINAL') lines.push('SUBSTITUI A CONFERENCIA ANTERIOR');

  if (document.comandaName) {
    lines.push(...wrapLine(`NOME: ${normalizeText(document.comandaName)}`));
  }
  if (copy && !document.comandaName) lines.push('NOME: CLIENTE NAO IDENTIFICADO');
  lines.push(`EMITIDO: ${formatDateTime(document.generatedAt)}`);
  if (document.kind === 'CHECKOUT_PREVIEW') lines.push('PAGAMENTO PENDENTE');
  else if (document.kind === 'CONFIRMED' && document.status === 'CLOSED') lines.push('COMANDA FECHADA');
  lines.push('-'.repeat(THERMAL_COLUMNS));

  for (const item of document.items) {
    lines.push(...wrapLine(`${item.quantity} x ${normalizeText(item.productName)}`));
    for (const additional of item.additionals) {
      lines.push(
        ...wrapLine(`  + ${additional.quantityPerUnit} por un. ${normalizeText(additional.name)}`),
      );
    }
    if (document.kind !== 'KITCHEN_PENDING') {
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
  if (document.kind !== 'KITCHEN_PENDING') {
    const itemsTotal = document.items.reduce(
      (total, item) => total + (item.subtotalCents ?? 0),
      0,
    );
    lines.push(columns(document.kind === 'COUNTER_PENDING' ? 'SUBTOTAL PENDENTE' : 'SUBTOTAL CONFIRMADO', formatCents(itemsTotal)));
    if (document.serviceFee) lines.push(columns(document.serviceFee.included ? 'TAXA DE SERVICO (10%)' : 'TAXA DE SERVICO DISPENSADA', formatCents(document.serviceFee.amountCents)));
    if (document.deliveryFeeCents !== null) {
      lines.push(columns('TAXA DE ENTREGA', formatCents(document.deliveryFeeCents)));
    }
    lines.push(columns('TOTAL', formatCents(document.totalCents ?? itemsTotal)));
    if (document.externalPaymentMethod === 'COUNTER' && document.status === 'CLOSED' && document.destination === 'COUNTER') {
      lines.push('PAGAMENTO: BALCAO (CAIXA EXTERNO)');
    }
  } else {
    lines.push('SOMENTE ITENS PENDENTES DE PREPARO');
  }
  lines.push('-'.repeat(THERMAL_COLUMNS));
  lines.push(...wrapLine(`OPERADOR: ${normalizeText(document.generatedBy)}`));
  return lines;
}

export function buildThermalReceiptBytes(document: ComandaPrintDocument, recipient?: CounterReceiptRecipient) {
  return Uint8Array.from(receiptCopies(document, recipient).flatMap((copy) => [
    ESC, 0x40, ESC, 0x74, 0x03,
    ...asciiBytes(buildReceiptCopyLines(document, copy).join('\n')),
    0x0a, ESC, 0x64, 0x04, GS, 0x56, 0x00,
  ]));
}

export function thermalReceiptPreview(document: ComandaPrintDocument, recipient?: CounterReceiptRecipient) {
  return buildThermalReceiptLines(document, recipient).join('\n');
}

function destinationLabel(document: ComandaPrintDocument) {
  if (document.destination === 'QUICK_SALE') return 'VENDA RAPIDA';
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
