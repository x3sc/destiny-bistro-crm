import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export interface TodayDashboard {
  closedSalesCents: number | null;
  date: string;
  occupiedTables: number | null;
  pendingKitchenTickets: number | null;
}

export async function loadTodayDashboard(
  apiBaseUrl: string,
): Promise<TodayDashboard> {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  if (!normalizedApiBaseUrl) {
    throw new Error('Missing API URL');
  }
  const response = await authenticatedFetch(
    `${normalizedApiBaseUrl}/dashboard/today`,
  );
  if (!response.ok) {
    throw new Error('Dashboard request failed');
  }
  const payload: unknown = await response.json();
  const today =
    payload && typeof payload === 'object' && 'today' in payload
      ? payload.today
      : null;
  if (!isTodayDashboard(today)) {
    throw new Error('Invalid dashboard response');
  }
  return today;
}

function isTodayDashboard(value: unknown): value is TodayDashboard {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<TodayDashboard>;
  return (
    (candidate.closedSalesCents === null || Number.isSafeInteger(candidate.closedSalesCents)) &&
    typeof candidate.date === 'string' &&
    isDateKey(candidate.date) &&
    isNullableInteger(candidate.occupiedTables) &&
    isNullableInteger(candidate.pendingKitchenTickets)
  );
}

function isDateKey(value: string): boolean {
  const parts = value.split('-');
  if (parts.length !== 3) {
    return false;
  }
  const [year, month, day] = parts;
  return (
    year.length === 4 &&
    month.length === 2 &&
    day.length === 2 &&
    parts.every((part) =>
      Array.from(part).every((character) =>
        character >= '0' && character <= '9'
      )
    )
  );
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && Number(value) >= 0);
}
