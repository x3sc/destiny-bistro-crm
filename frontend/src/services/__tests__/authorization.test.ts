import { canManageMenu, canManageUsers, hasAppPermission } from '../authorization';

const user = {
  establishment: { id: 'establishment-id', name: 'Destiny' },
  id: 'user-id',
  name: 'Owner',
  permissions: ['statements.read'],
  roles: [{ code: 'OWNER', id: 'role-id', name: 'Dono' }],
};

it('denies menu management without an explicit current permission even for owners', () => {
  expect(canManageMenu(user)).toBe(false);
});

it('allows explicit product writers independently of role name', () => {
  expect(canManageMenu({ ...user, roles: [{ ...user.roles[0], code: 'MANAGER' }] })).toBe(false);
  expect(canManageMenu({ ...user, permissions: ['products.write'], roles: [] })).toBe(true);
  expect(canManageMenu({ ...user, roles: [{ ...user.roles[0], code: 'WAITER' }] })).toBe(false);
});

it('requires users.manage for delegated user administration', () => {
  const owner = { ...user, permissions: ['users.manage'] };
  expect(canManageUsers(owner)).toBe(true);
  expect(canManageUsers(user)).toBe(false);
  expect(canManageUsers(null)).toBe(false);
  for (const code of ['MANAGER', 'WAITER', 'KITCHEN']) {
    expect(canManageUsers({ ...owner, roles: [{ ...owner.roles[0], code }] })).toBe(true);
  }
});

it('uses explicit credit permissions independently of role name', () => {
  for (const code of ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN']) {
    const actor = { ...user, permissions: ['credits.read', 'credits.write', 'comandas.write'], roles: [{ ...user.roles[0], code }] };
    expect(hasAppPermission(actor, 'credits.read')).toBe(true);
    expect(hasAppPermission(actor, 'credits.write')).toBe(true);
    expect(hasAppPermission(actor, 'comandas.write')).toBe(true);
  }
  expect(hasAppPermission(null, 'credits.read')).toBe(false);
  expect(hasAppPermission(user, 'credits.write')).toBe(false);
});
