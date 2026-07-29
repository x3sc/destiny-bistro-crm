import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const storageKey = 'destiny-bistro-session';
let activeToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export interface StoredSession {
  expiresAt: string;
  token: string;
}

export function configureAuthenticatedFetch(
  token: string | null,
  onUnauthorized?: () => void,
) {
  activeToken = token;
  unauthorizedHandler = onUnauthorized ?? null;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = activeToken
    ? {
        ...Object.fromEntries(new Headers(init.headers).entries()),
        Authorization: `Bearer ${activeToken}`,
      }
    : init.headers;

  const requestInit = {
    ...init,
    ...(headers ? { headers } : {}),
  };
  const response =
    Object.keys(requestInit).length === 0
      ? await fetch(input)
      : await fetch(input, requestInit);

  if (response.status === 401 && activeToken) {
    unauthorizedHandler?.();
  }

  return response;
}

export function getActiveAuthToken() {
  return activeToken;
}

export async function readStoredSession(): Promise<StoredSession | null> {
  const raw =
    Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(storageKey) ?? null
      : await SecureStore.getItemAsync(storageKey);

  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (
      value &&
      typeof value === 'object' &&
      typeof (value as Partial<StoredSession>).expiresAt === 'string' &&
      typeof (value as Partial<StoredSession>).token === 'string'
    ) {
      return value as StoredSession;
    }
  } catch {
    await clearStoredSession();
  }

  return null;
}

export async function storeSession(session: StoredSession) {
  const serialized = JSON.stringify(session);

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(storageKey, serialized);
    return;
  }

  await SecureStore.setItemAsync(storageKey, serialized);
}

export async function clearStoredSession() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(storageKey);
    return;
  }

  await SecureStore.deleteItemAsync(storageKey);
}
