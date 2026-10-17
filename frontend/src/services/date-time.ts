const OPERATIONAL_TIME_ZONE = 'America/Sao_Paulo';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  hourCycle: 'h23',
  timeStyle: 'short',
  timeZone: OPERATIONAL_TIME_ZONE,
});

export function formatOperationalDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}
