import { login } from '../auth-api';
import {
  authenticatedFetch,
  configureAuthenticatedFetch,
} from '../auth-session';

const user = {
  establishment: {
    id: 'establishment-id',
    name: 'Destiny Bistro',
  },
  id: 'user-id',
  name: 'Gustavo',
  permissions: ['tables.read'],
  roles: [{ code: 'OWNER', id: 'role-id', name: 'Dono' }],
};

afterEach(() => {
  configureAuthenticatedFetch(null);
  jest.restoreAllMocks();
});

it('logs in with the public endpoint and validates the session contract', async () => {
  const fetchImplementation = jest.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          session: {
            expiresAt: '2026-07-29T15:00:00.000Z',
            token: 'valid-authentication-token',
            user,
          },
        }),
        { status: 200 },
      ),
    ),
  );

  await expect(
    login(
      'http://localhost:3333/',
      '  Gustavo  ',
      'password-ok',
      fetchImplementation,
    ),
  ).resolves.toEqual({
    expiresAt: '2026-07-29T15:00:00.000Z',
    token: 'valid-authentication-token',
    user,
  });
  expect(fetchImplementation).toHaveBeenCalledWith(
    'http://localhost:3333/auth/login',
    {
      body: JSON.stringify({
        name: 'Gustavo',
        password: 'password-ok',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
});

it('adds the bearer token to protected API requests', async () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = jest.fn(() =>
    Promise.resolve(new Response('{}', { status: 200 })),
  );
  globalThis.fetch = mockFetch;
  configureAuthenticatedFetch('valid-authentication-token');

  try {
    await authenticatedFetch('http://localhost:3333/tables');
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/tables',
    {
      headers: {
        Authorization: 'Bearer valid-authentication-token',
      },
    },
  );
});
