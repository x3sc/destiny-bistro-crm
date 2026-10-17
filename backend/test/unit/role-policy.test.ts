import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canEditRole, validateRolePermissions, RoleAccessError } from '../../src/role-policy.js';
import type { AuthUser } from '../../src/auth-types.js';

const delegate: AuthUser = { id: 'operator', name: 'Operator', establishment: { id: 'tenant', name: 'Tenant' },
  roles: [{ id: 'own', code: 'CUSTOM', name: 'Admin' }], permissions: ['roles.manage', 'counter-sales.read', 'products.read'] };
void test('delegated role administration cannot change its own group or escalate privileges', () => {
  const role = { id: 'other', protected: false, permissions: ['counter-sales.read'] };
  assert.equal(canEditRole(delegate, role, ['counter-sales.read']), true);
  assert.equal(canEditRole(delegate, { ...role, id: 'own' }, []), false);
  assert.equal(canEditRole(delegate, role, ['users.manage']), false);
  assert.equal(canEditRole(delegate, { ...role, permissions: ['users.manage'] }, []), false);
  assert.equal(canEditRole(delegate, { ...role, permissions: ['statements.read'] }, []), false);
  assert.equal(canEditRole(delegate, { ...role, protected: true }, []), false);
});
void test('role permissions reject unknown codes, missing dependencies and duplicates', () => {
  assert.throws(() => validateRolePermissions(['unknown']), RoleAccessError);
  assert.throws(() => validateRolePermissions(['counter-sales.write']), RoleAccessError);
  assert.throws(() => validateRolePermissions(['counter-sales.read', 'counter-sales.read']), RoleAccessError);
  assert.deepEqual(validateRolePermissions(['counter-sales.read', 'products.read', 'counter-sales.write']),
    ['counter-sales.read', 'counter-sales.write', 'products.read']);
});
