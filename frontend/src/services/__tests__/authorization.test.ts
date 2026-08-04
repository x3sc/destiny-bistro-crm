import { canManageMenu } from '../authorization';

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
