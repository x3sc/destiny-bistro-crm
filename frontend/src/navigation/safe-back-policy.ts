export interface NavigationResource {
  comandaId?: string;
  kind?: 'tables' | 'quick-sales' | 'counter' | 'credit';
  customerId?: string;
  courierId?: string;
  orderId?: string;
}
export interface RouteNode {
  name: string;
  key?: string;
  params?: Readonly<object>;
  state?: NavigationState;
}
export interface NavigationState { index?: number; routes: RouteNode[] }
const segment = (value: string) => encodeURIComponent(value);

export function logicalParent(path: string, resource: NavigationResource = {}): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'admin') return parts.length > 2 ? `/admin/${parts[1]}` : parts.length > 1 ? '/admin' : '/';
  if (parts[0] === 'counter-sales') return parts.length > 1 ? '/counter-sales' : '/';
  if (parts[0] === 'tables') return parts.length > 1 ? '/tables' : '/';
  if (parts[0] === 'credits') {
    if (parts.length > 2) return `/credits/${parts[1]}`;
    return parts.length > 1 ? '/credits' : '/';
  }
  if (parts[0] === 'deliveries') {
    if (parts[1] === 'orders') return parts.length > 3 ? `/deliveries/orders/${parts[2]}` : '/deliveries';
    if (parts[1] === 'days') return resource.courierId ? `/deliveries/${segment(resource.courierId)}` : '/deliveries';
    return parts.length > 1 && parts[1] !== 'couriers' ? '/deliveries/couriers' : parts.length > 1 ? '/deliveries' : '/';
  }
  if (parts[0] === 'comandas') {
    if (parts.length > 2) return resource.kind === 'counter' ? `/counter-sales/${parts[1]}` : `/comandas/${parts[1]}`;
    if (resource.comandaId !== decodeURIComponent(parts[1] ?? '')) return '/';
    if (resource.kind === 'credit') return resource.customerId ? `/credits/${segment(resource.customerId)}` : '/credits';
    return resource.kind ? `/${resource.kind === 'counter' ? 'counter-sales' : resource.kind}` : '/';
  }
  return '/';
}

export function isAllowedDestination(path: string, hasPermission: (permission: string) => boolean): boolean {
  if (path === '/') return true;
  if (/^\/tables(?:\/|$)/.test(path)) return hasPermission('tables.read');
  if (/^\/counter-sales(?:\/|$)/.test(path)) return hasPermission('counter-sales.read');
  if (path === '/quick-sales') return hasPermission('quick-sales.read');
  if (/^\/comandas(?:\/|$)/.test(path)) return ['comandas', 'quick-sales', 'counter-sales', 'credits', 'deliveries'].some((scope) => hasPermission(`${scope}.read`));
  if (/^\/credits(?:\/|$)/.test(path)) return hasPermission('credits.read');
  if (/^\/deliveries(?:\/|$)/.test(path)) return hasPermission('deliveries.read');
  if (path === '/kitchen') return hasPermission('kitchen.read');
  if (path === '/statements' || path === '/admin/statements') return hasPermission('statements.read');
  if (path === '/admin/users') return hasPermission('users.manage');
  if (/^\/admin\/users\//.test(path)) return hasPermission('users.manage');
  if (/^\/admin\/roles(?:\/|$)/.test(path)) return hasPermission('roles.manage');
  if (path === '/admin/menu') return hasPermission('products.write');
  if (path === '/admin/inventory') return hasPermission('inventory.read');
  return path === '/admin' && ['products.write', 'inventory.read', 'statements.read', 'users.manage', 'roles.manage'].some(hasPermission);
}

export function isSafeHistory(current: string, previous: string): boolean {
  if (current === previous || previous.startsWith(`${current}/`)) return false;
  if (['/tables', '/quick-sales', '/counter-sales', '/credits', '/deliveries', '/admin', '/kitchen', '/statements'].includes(current)) {
    return previous === '/' || !/^\/(?:comandas|counter-sales|credits|deliveries|tables)\//.test(previous);
  }
  if (/^\/(?:comandas|counter-sales)\/[^/]+$/.test(current) && /^\/comandas\/[^/]+\/(?:products|checkout|credit)$/.test(previous)) return false;
  if (/^\/(?:comandas|counter-sales)\//.test(current) && /^\/tables\/[^/]+\/open$/.test(previous)) return false;
  if (/^\/deliveries\/orders\/[^/]+/.test(current) && previous === '/deliveries/orders/new') return false;
  if (/^\/comandas\//.test(current) && previous === '/credits/new') return false;
  return true;
}

function routePath(route: RouteNode, prefix: string): string {
  if (route.name === '__root') return prefix || '/';
  const name = route.name.replace(/\[([^\]]+)\]/g, (_, key: string) => segment(String((route.params as Record<string, unknown> | undefined)?.[key] ?? '')));
  return `${prefix}/${name}`.replace(/\/index$/, '').replace(/\/$/, '') || '/';
}
export function activeLeaf(state: NavigationState, prefix = ''): { path: string; key?: string } | undefined {
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (!route) return undefined;
  const path = routePath(route, prefix);
  return route.state ? activeLeaf(route.state, path === '/' ? '' : path) : { path, key: route.key };
}
export function previousLeaf(state: NavigationState, prefix = ''): { path: string; key?: string } | undefined {
  const index = state.index ?? state.routes.length - 1;
  const route = state.routes[index];
  if (!route) return undefined;
  const path = routePath(route, prefix);
  const nested = route.state && previousLeaf(route.state, path === '/' ? '' : path);
  if (nested) return nested;
  const previous = state.routes[index - 1];
  if (!previous) return undefined;
  const previousPath = routePath(previous, prefix);
  return previous.state ? activeLeaf(previous.state, previousPath === '/' ? '' : previousPath) : { path: previousPath, key: previous.key };
}

export function canonicalRoutes(path: string): RouteNode[] {
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const routes: RouteNode[] = [{ name: 'index' }];
  if (!parts.length) return routes;
  if (parts[0] === 'credits') {
    const nested: RouteNode[] = [{ name: 'index' }];
    if (parts[1] && parts[1] !== 'new') nested.push({ name: '[customerId]', params: { customerId: parts[1] } });
    routes.push({ name: 'credits', state: { index: nested.length - 1, routes: nested } });
    return routes;
  }
  const fixed: Record<string, string> = { tables: 'tables/index', 'counter-sales': 'counter-sales/index',
    deliveries: 'deliveries/index', admin: 'admin/index', kitchen: 'kitchen/index', statements: 'statements/index', 'quick-sales': 'quick-sales' };
  if (parts[0] === 'comandas' && parts[1]) routes.push({ name: 'comandas/[comandaId]', params: { comandaId: parts[1] } });
  else if (parts[0] === 'counter-sales' && parts[1]) routes.push({ name: 'counter-sales/index' }, { name: 'counter-sales/[comandaId]', params: { comandaId: parts[1] } });
  else if (parts[0] === 'deliveries' && parts[1] === 'orders' && parts[2]) routes.push({ name: 'deliveries/index' }, { name: 'deliveries/orders/[orderId]/index', params: { orderId: parts[2] } });
  else if (parts[0] === 'deliveries' && parts[1] === 'couriers') routes.push({ name: 'deliveries/index' }, { name: 'deliveries/couriers/index' });
  else if (parts[0] === 'deliveries' && parts[1]) routes.push({ name: 'deliveries/index' }, { name: 'deliveries/couriers/index' }, { name: 'deliveries/[courierId]', params: { courierId: parts[1] } });
  else if (parts[0] === 'admin' && parts[1]) routes.push({ name: 'admin/index' }, { name: `admin/${parts[1]}/index` });
  else if (fixed[parts[0]]) routes.push({ name: fixed[parts[0]] });
  return routes;
}
