import { logicalParent, isAllowedDestination, previousLeaf, canonicalRoutes, isSafeHistory } from '../safe-back-policy';

const allow = () => true;
it('does not return from details to an obsolete catalog, checkout or opening screen', () => {
  expect(isSafeHistory('/comandas/one', '/comandas/one/products')).toBe(false);
  expect(isSafeHistory('/counter-sales/one', '/comandas/one/checkout')).toBe(false);
  expect(isSafeHistory('/comandas/one/products', '/tables/1/open')).toBe(false);
  expect(isSafeHistory('/comandas/one/checkout', '/comandas/one')).toBe(true);
  expect(isSafeHistory('/credits/person', '/credits/person/orders/order/payment')).toBe(false);
});
it('maps direct entries to their logical parents without using query origin as authority', () => {
  expect(logicalParent('/quick-sales')).toBe('/');
  expect(logicalParent('/comandas/one/products')).toBe('/comandas/one');
  expect(logicalParent('/comandas/one')).toBe('/');
  expect(logicalParent('/comandas/one', { comandaId: 'one', kind: 'counter' })).toBe('/counter-sales');
  expect(logicalParent('/comandas/one', { comandaId: 'one', kind: 'credit', customerId: 'person' })).toBe('/credits/person');
  expect(logicalParent('/credits/person/orders/order/payment')).toBe('/credits/person');
  expect(logicalParent('/deliveries/days/day')).toBe('/deliveries');
  expect(logicalParent('/deliveries/days/day', { courierId: 'courier' })).toBe('/deliveries/courier');
});
it('checks module permissions, denies unknown destinations, and always permits home', () => {
  expect(isAllowedDestination('/tables', () => false)).toBe(false);
  expect(isAllowedDestination('/admin', (p) => p === 'users.manage')).toBe(true);
  expect(isAllowedDestination('/counter-sales', allow)).toBe(true);
  expect(isAllowedDestination('/unknown', allow)).toBe(false);
  expect(isAllowedDestination('/', () => false)).toBe(true);
});
it('finds the actual previous leaf inside nested stacks before falling back to the root', () => {
  const root = { index: 1, routes: [{ name: 'index' }, { name: 'credits', state: { index: 1, routes: [
    { name: 'index' }, { name: '[customerId]', params: { customerId: 'person' } },
  ] } }] };
  expect(previousLeaf(root)?.path).toBe('/credits');
  expect(previousLeaf({ index: 0, routes: [{ name: 'quick-sales' }] })).toBeUndefined();
});
it('constructs canonical nested stacks without duplicate home or incomplete dynamic routes', () => {
  expect(canonicalRoutes('/').map((r) => r.name)).toEqual(['index']);
  const routes = canonicalRoutes('/credits/person');
  expect(routes.map((r) => r.name)).toEqual(['index', 'credits']);
  expect(routes[1].state?.routes.map((r) => r.name)).toEqual(['index', '[customerId]']);
  expect(canonicalRoutes('/comandas/one').map((r) => r.name)).toEqual(['index', 'comandas/[comandaId]']);
});
