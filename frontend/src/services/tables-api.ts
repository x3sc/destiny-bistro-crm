export type RestaurantTableStatus = 'FREE' | 'OPEN' | 'AWAITING_CHECK';

export interface RestaurantTable {
  id: number;
  number: number;
  status: RestaurantTableStatus;
}

interface TablesResponse {
  tables: RestaurantTable[];
}

const restaurantTableStatuses = new Set<RestaurantTableStatus>([
  'FREE',
  'OPEN',
  'AWAITING_CHECK',
]);

export function normalizeApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '');
}

function isRestaurantTable(value: unknown): value is RestaurantTable {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const table = value as Partial<RestaurantTable>;

  return (
    Number.isInteger(table.id) &&
    Number.isInteger(table.number) &&
    restaurantTableStatuses.has(table.status as RestaurantTableStatus)
  );
}

function isTablesResponse(value: unknown): value is TablesResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Partial<TablesResponse>;

  return Array.isArray(response.tables) && response.tables.every(isRestaurantTable);
}

export async function loadTables(apiBaseUrl: string): Promise<RestaurantTable[]> {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

  if (!normalizedApiBaseUrl) {
    throw new Error('Missing API URL');
  }

  const response = await fetch(`${normalizedApiBaseUrl}/tables`);

  if (!response.ok) {
    throw new Error('Tables request failed');
  }

  const payload: unknown = await response.json();

  if (!isTablesResponse(payload)) {
    throw new Error('Invalid tables response');
  }

  return payload.tables;
}
