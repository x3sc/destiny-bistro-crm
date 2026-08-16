const BRAZILIAN_MOBILE_PATTERN = /^[1-9]\d9\d{8}$/u;

export function brazilianMobileDigits(value: string) {
  return value.replace(/\D/gu, '').slice(0, 11);
}

export function formatBrazilianMobile(value: string) {
  const digits = brazilianMobileDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const firstPart = digits.slice(2, 7);
  const lastPart = digits.slice(7);
  return `(${ddd}) ${firstPart}${lastPart ? `-${lastPart}` : ''}`;
}

export function isBrazilianMobile(value: string) {
  return BRAZILIAN_MOBILE_PATTERN.test(brazilianMobileDigits(value));
}
