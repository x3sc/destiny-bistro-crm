const brlFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
});

export function formatCentsAsBrl(value: number) {
  return brlFormatter.format(value / 100);
}

export function centsFromBrlInput(value: string) {
  const digits = value.replace(/\D/gu, '').slice(-9);
  return digits ? Number(digits) : 0;
}

export function formatCentsForBrlInput(value: number) {
  const integerPart = Math.floor(value / 100).toLocaleString('pt-BR');
  const decimalPart = String(value % 100).padStart(2, '0');
  return `R$ ${integerPart},${decimalPart}`;
}
