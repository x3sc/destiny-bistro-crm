import { configureAuthenticatedFetch } from '../auth-session';
import { createUser, loadUsers, UserApiError } from '../users-api';

const user = { id: 'new-user', name: 'Ana', active: true, roles: [{ id: 'role', code: 'WAITER', name: 'Garçom' }] };
const mockFetch = jest.fn();
beforeEach(() => { globalThis.fetch = mockFetch; configureAuthenticatedFetch('test-token'); mockFetch.mockReset(); });
afterEach(() => configureAuthenticatedFetch(null));

it('loads authenticated users and available roles', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ users: [user], roles: user.roles }) });
  expect(await loadUsers('http://localhost:3333/')).toEqual({ users: [user], roles: user.roles });
  expect(mockFetch).toHaveBeenCalledWith('http://localhost:3333/admin/users', expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
});

it('creates with one role and only the access fields', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ user }) });
  const input = { name: 'Ana', password: 'test-password', roleCode: 'WAITER' as const };
  expect(await createUser('http://localhost:3333', input)).toEqual(user);
  expect(mockFetch).toHaveBeenCalledWith('http://localhost:3333/admin/users', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
});

it.each([400, 401, 403, 409, 503])('preserves status %s for actionable UI errors', async (status) => {
  mockFetch.mockResolvedValue({ ok: false, status });
  await expect(createUser('http://localhost:3333', { name: 'Ana', password: 'test-password', roleCode: 'WAITER' })).rejects.toMatchObject({ status });
});

it('rejects malformed lists and creation responses', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ users: [{ ...user, roles: 'OWNER' }], roles: [] }) });
  await expect(loadUsers('http://localhost:3333')).rejects.toBeInstanceOf(UserApiError);
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ user: { ...user, active: 'true' } }) });
  await expect(createUser('http://localhost:3333', { name: 'Ana', password: 'test-password', roleCode: 'WAITER' })).rejects.toBeInstanceOf(UserApiError);
});
