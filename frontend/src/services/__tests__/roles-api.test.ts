import { configureAuthenticatedFetch } from '../auth-session';
import { loadRoles, saveRole, setPermission, RoleApiError } from '../roles-api';
const fetchMock = jest.fn();
beforeEach(() => { globalThis.fetch = fetchMock; configureAuthenticatedFetch('test-token'); fetchMock.mockReset(); });
afterEach(() => configureAuthenticatedFetch(null));
const role = { id: 'role', code: 'CUSTOM_role', name: 'Balcão', description: null, protected: false, version: 1, userCount: 0, permissions: ['counter-sales.read'], canEdit: true, canDelete: true };
const permissions = [{ code: 'counter-sales.read', name: 'Visualizar Balcão', group: 'counter-sales', dependencies: [], ownerOnly: false },
  { code: 'counter-sales.write', name: 'Operar Balcão', group: 'counter-sales', dependencies: ['counter-sales.read'], ownerOnly: false }];
it('loads a strict authenticated contract and excludes tenant or protected fields from writes', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ roles: [role], permissions }) });
  expect((await loadRoles('http://localhost:3333')).roles).toEqual([role]);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ role }) });
  await saveRole('http://localhost:3333', { name: role.name, description: null, permissions: role.permissions });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: role.name, description: null, permissions: role.permissions });
});
it('keeps server conflicts actionable and rejects malformed role data', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 409 });
  await expect(saveRole('http://localhost:3333', { name: 'Cargo', permissions: [] }, role)).rejects.toMatchObject({ status: 409 });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ roles: [{ ...role, permissions: 'all' }], permissions }) });
  await expect(loadRoles('http://localhost:3333')).rejects.toBeInstanceOf(RoleApiError);
});
it('enables dependencies and removes dependents when a prerequisite is removed', () => {
  expect(setPermission([], 'counter-sales.write', true, permissions)).toEqual(['counter-sales.read', 'counter-sales.write']);
  expect(setPermission(['counter-sales.read', 'counter-sales.write'], 'counter-sales.read', false, permissions)).toEqual([]);
});
