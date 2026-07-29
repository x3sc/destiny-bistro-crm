import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export interface AuthRole {
  code: string;
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  name: string;
  permissions: string[];
  roles: AuthRole[];
}

export interface AuthSession {
  expiresAt: string;
  token: string;
  user: AuthUser;
}

export async function login(
  apiBaseUrl: string,
  name: string,
  password: string,
  fetchImplementation: typeof fetch = fetch,
) {
  const response = await fetchImplementation(
    `${requireApiBaseUrl(apiBaseUrl)}/auth/login`,
    {
      body: JSON.stringify({
        name: name.trim(),
        password,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Nome ou senha inválidos.'
        : 'Não foi possível entrar agora.',
    );
  }

  const payload: unknown = await response.json();
  const session =
    payload && typeof payload === 'object'
      ? (payload as { session?: unknown }).session
      : undefined;

  if (!isAuthSession(session)) {
    throw new Error('Resposta de autenticação inválida.');
  }

  return session;
}

export async function loadCurrentUser(apiBaseUrl: string) {
  const response = await authenticatedFetch(
    `${requireApiBaseUrl(apiBaseUrl)}/auth/me`,
  );

  if (!response.ok) {
    throw new Error('Sessão inválida.');
  }

  const payload: unknown = await response.json();
  const user =
    payload && typeof payload === 'object'
      ? (payload as { user?: unknown }).user
      : undefined;

  if (!isAuthUser(user)) {
    throw new Error('Resposta de usuário inválida.');
  }

  return user;
}

export async function logout(apiBaseUrl: string) {
  await authenticatedFetch(`${requireApiBaseUrl(apiBaseUrl)}/auth/logout`, {
    method: 'POST',
  });
}

function requireApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);

  if (!normalized) {
    throw new Error('Endereço da API não configurado.');
  }

  return normalized;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return (
    typeof session.expiresAt === 'string' &&
    typeof session.token === 'string' &&
    session.token.length >= 20 &&
    isAuthUser(session.user)
  );
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Partial<AuthUser>;

  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    Array.isArray(user.permissions) &&
    user.permissions.every((permission) => typeof permission === 'string') &&
    Array.isArray(user.roles) &&
    user.roles.every(isAuthRole)
  );
}

function isAuthRole(value: unknown): value is AuthRole {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const role = value as Partial<AuthRole>;

  return (
    typeof role.code === 'string' &&
    typeof role.id === 'string' &&
    typeof role.name === 'string'
  );
}
