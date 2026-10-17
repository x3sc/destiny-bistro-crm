import { useEffect, useMemo, useRef } from 'react';
import { useNavigationContainerRef, usePathname } from 'expo-router';
import { useAuth } from '../auth/auth-context';
import { useSafeNavigationCompletion } from './safe-navigation';

export function AuthorizationSessionBoundary() {
  const { user, refreshSession } = useAuth();
  const root = useNavigationContainerRef();
  const pathname = usePathname();
  const complete = useSafeNavigationCompletion();
  const previous = useRef(user?.permissions ?? []);
  const permissions = useMemo(() => user?.permissions ?? [], [user?.permissions]);
  useEffect(() => { void refreshSession(); }, [pathname, refreshSession]);
  useEffect(() => {
    const revoked = previous.current.some((permission) => !permissions.includes(permission));
    previous.current = permissions;
    if (!revoked || !root.isReady()) return;
    complete(() => {
      const state = root.getRootState();
      const appState = state.routes.find((route) => route.name === '__root')?.state ?? state;
      root.dispatch({ type: 'RESET', target: appState.key, payload: { index: 0, routes: [{ name: 'index' }] } });
    });
  }, [permissions, root, complete]);
  return null;
}
