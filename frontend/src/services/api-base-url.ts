export function normalizeApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '');
}
