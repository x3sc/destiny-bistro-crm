import { canManageMenu, canManageUsers, hasAppPermission } from '../authorization';

const user = {
  establishment: { id: 'establishment-id', name: 'Destiny' },
  id: 'user-id',
  name: 'Owner',
  permissions: ['statements.read'],
  roles: [{ code: 'OWNER', id: 'role-id', name: 'Dono' }],
};

it('keeps menu management visible for owners with a stale permission snapshot', () => {
  expect(canManageMenu(user)).toBe(true);
});

it('allows managers and explicit product writers but not operational roles', () => {
  expect(canManageMenu({ ...user, roles: [{ ...user.roles[0], code: 'MANAGER' }] })).toBe(true);
  expect(canManageMenu({ ...user, permissions: ['products.write'], roles: [] })).toBe(true);
  expect(canManageMenu({ ...user, roles: [{ ...user.roles[0], code: 'WAITER' }] })).toBe(false);
});

it('requires OWNER and users.manage for user administration', () => {
  const owner = { ...user, permissions: ['users.manage'] };
  expect(canManageUsers(owner)).toBe(true);
  expect(canManageUsers(user)).toBe(false);
  expect(canManageUsers(null)).toBe(false);
  for (const code of ['MANAGER', 'WAITER', 'KITCHEN']) {
    expect(canManageUsers({ ...owner, roles: [{ ...owner.roles[0], code }] })).toBe(false);
  }
});

it('restricts credit permissions to owner or manager even with legacy grants', () => {
  for (const code of ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN']) {
    const actor = { ...user, permissions: ['credits.read', 'credits.write', 'comandas.write'], roles: [{ ...user.roles[0], code }] };
    expect(hasAppPermission(actor, 'credits.read')).toBe(['OWNER', 'MANAGER'].includes(code));
    expect(hasAppPermission(actor, 'credits.write')).toBe(['OWNER', 'MANAGER'].includes(code));
    expect(hasAppPermission(actor, 'comandas.write')).toBe(true);
  }
  expect(hasAppPermission(null, 'credits.read')).toBe(false);
  expect(hasAppPermission(user, 'credits.write')).toBe(false);
});
