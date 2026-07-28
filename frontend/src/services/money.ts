const brlFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
});

export function formatCentsAsBrl(value: number) {
  return brlFormatter.format(value / 100);
}
