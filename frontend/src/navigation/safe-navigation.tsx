import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused, useNavigation, useNavigationContainerRef, usePathname, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import { Alert, BackHandler, Platform } from 'react-native';
import { activeLeaf, canonicalRoutes, isAllowedDestination, isSafeHistory, logicalParent, previousLeaf, type NavigationResource } from './safe-back-policy';
import type { Comanda } from '../services/comandas-api';

export interface NavigationGuard {
  onBack?: () => void;
  busy?: boolean;
  dirty?: boolean;
  discard?: () => void;
  closeModal?: () => void;
  resource?: NavigationResource;
}
interface GuardEntry { focused: () => boolean; read: () => NavigationGuard }
interface SafeNavigation {
  back: () => void;
  attempt: (action: () => void) => void;
  complete: (action: () => void) => void;
  register: (entry: GuardEntry) => () => void;
  update: () => void;
  blocked: boolean;
}
const NavigationContext = createContext<SafeNavigation | null>(null);
const RouteScope = createContext<{ focused: () => boolean } | null>(null);

export function comandaNavigationResource(comanda: Comanda): NavigationResource {
  return { comandaId: comanda.id, kind: comanda.credit ? 'credit' : comanda.table ? 'tables' :
    comanda.tableName === 'Balcão' ? 'counter' : comanda.tableName === 'Venda rápida' ? 'quick-sales' : undefined,
    customerId: comanda.credit?.customerId };
}

export function SafeNavigationProvider({ children, canAccess }: { children: ReactNode; canAccess: (permission: string) => boolean }) {
  const root = useNavigationContainerRef();
  const pathname = usePathname();
  const entries = useRef(new Map<symbol, GuardEntry>());
  const permit = useRef(false);
  const permittedSource = useRef<string | undefined>(undefined);
  const navigating = useRef(false);
  const dialog = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const update = useCallback(() => setBlocked([...entries.current.values()].filter((entry) => entry.focused())
    .some((entry) => { const guard = entry.read(); return Boolean(guard.busy || guard.dirty || guard.closeModal); })), []);
  const focused = () => [...entries.current.values()].filter((entry) => entry.focused()).map((entry) => entry.read());
  useEffect(() => {
    const unsubscribe = root.addListener('state', ({ data }) => {
      const key = data.state && activeLeaf(data.state)?.key;
      if (key && key !== permittedSource.current) {
        permit.current = false; navigating.current = false; dialog.current = false;
      }
    });
    return unsubscribe;
  }, [root]);
  useEffect(() => {
    permit.current = false; navigating.current = false; dialog.current = false;
  }, [pathname]);
  const register = useCallback((entry: GuardEntry) => {
    const token = Symbol(); entries.current.set(token, entry); update();
    return () => { entries.current.delete(token); update(); };
  }, [update]);

  const confirm = (title: string, message: string, label: string, action: () => void) => {
    if (dialog.current) return;
    dialog.current = true;
    const cancel = () => { dialog.current = false; };
    const accept = () => { dialog.current = false; action(); };
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) accept(); else cancel();
    } else Alert.alert(title, message, [
      { text: title === 'Sair do aplicativo?' ? 'Permanecer' : 'Continuar editando', style: 'cancel', onPress: cancel },
      { text: label, style: 'destructive', onPress: accept },
    ], { cancelable: true, onDismiss: cancel });
  };
  const attempt = (action: () => void) => {
    if (permit.current && activeLeaf(root.getRootState())?.key === permittedSource.current) { action(); return; }
    const guards = focused();
    if (guards.some((guard) => guard.busy)) {
      const message = 'A operação está sendo registrada. Aguarde antes de sair desta tela.';
      if (Platform.OS === 'web') window.alert(`Aguarde a conclusão\n\n${message}`);
      else Alert.alert('Aguarde a conclusão', message);
      return;
    }
    const modal = [...guards].reverse().find((guard) => guard.closeModal);
    if (modal?.closeModal) { modal.closeModal(); return; }
    const proceed = () => {
      if (focused().some((guard) => guard.busy)) return;
      permittedSource.current = activeLeaf(root.getRootState())?.key;
      permit.current = true;
      try { action(); } finally { permit.current = false; }
    };
    if (guards.some((guard) => guard.dirty)) {
      const currentKey = activeLeaf(root.getRootState())?.key;
      confirm('Descartar alterações?', 'Somente as alterações locais ainda não adicionadas serão descartadas.', 'Descartar e voltar', () => {
        if (activeLeaf(root.getRootState())?.key !== currentKey || focused().some((guard) => guard.busy)) return;
        focused().forEach((guard) => { if (guard.dirty) guard.discard?.(); });
        proceed();
      });
      return;
    }
    proceed();
  };
  const back = () => {
    if (!root.isReady() || navigating.current) return;
    const currentKey = activeLeaf(root.getRootState())?.key;
    attempt(() => {
      if (activeLeaf(root.getRootState())?.key !== currentKey || navigating.current) return;
      const localBack = focused().map((guard) => guard.onBack).filter(Boolean).at(-1);
      if (localBack) { localBack(); return; }
      const state = root.getRootState();
      const currentPath = activeLeaf(state)?.path ?? pathname;
      if (currentPath === '/') {
        permit.current = false;
        if (Platform.OS === 'android') confirm('Sair do aplicativo?', 'Deseja sair do aplicativo?', 'Sair', () => {
          if ((activeLeaf(root.getRootState())?.path ?? pathname) === '/') BackHandler.exitApp();
        });
        return;
      }
      const previous = previousLeaf(state);
      navigating.current = true;
      if (previous && isSafeHistory(currentPath, previous.path) && isAllowedDestination(previous.path, canAccess) && root.canGoBack()) {
        root.goBack();
      } else {
        const resource = focused().map((guard) => guard.resource).filter(Boolean).at(-1);
        const parent = logicalParent(currentPath, resource);
        const destination = parent !== currentPath && isAllowedDestination(parent, canAccess) ? parent : '/';
        const routes = canonicalRoutes(destination);
        const appState = state.routes.find((route) => route.name === '__root')?.state ?? state;
        root.dispatch({ type: 'RESET', target: appState.key, payload: { index: routes.length - 1, routes } });
      }
    });
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (focused().some((guard) => guard.dirty || guard.busy)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  return <NavigationContext.Provider value={{ back, attempt, blocked, register, update,
    complete: (action) => { permittedSource.current = activeLeaf(root.getRootState())?.key; permit.current = true; action(); } }}>{children}</NavigationContext.Provider>;
}

export function SafeRouteBoundary({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const safe = useContext(NavigationContext);
  const scope = useMemo(() => ({ focused: () => navigation.isFocused() }), [navigation]);
  const safeRef = useRef(safe);
  useLayoutEffect(() => { safeRef.current = safe; });
  usePreventRemove(Boolean(safe?.blocked && isFocused), ({ data }) => {
    // Keep the original source when resuming an action across nested stacks.
    safeRef.current?.attempt(() => navigation.dispatch({ ...data.action, source: data.action.source }));
  });
  useFocusEffect(useCallback(() => {
    safeRef.current?.update();
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      safeRef.current?.back(); return true;
    });
    return () => subscription.remove();
  }, [navigation]));
  return <RouteScope.Provider value={scope}>{children}</RouteScope.Provider>;
}

export function useSafeBack(fallback?: () => void) {
  const safe = useContext(NavigationContext);
  const scope = useContext(RouteScope);
  return () => { if (!scope || scope.focused()) (safe?.back ?? fallback)?.(); };
}
export function useRouteSafeBack() {
  const router = useRouter();
  return useSafeBack(() => {
    if (router.canGoBack()) router.back(); else router.replace('/');
  });
}
export function useSafeNavigationCompletion() {
  return useContext(NavigationContext)?.complete ?? ((action: () => void) => action());
}
export function useNavigationGuard(guard: NavigationGuard) {
  const safe = useContext(NavigationContext);
  const scope = useContext(RouteScope);
  const current = useRef(guard);
  useLayoutEffect(() => { current.current = guard; });
  const register = safe?.register;
  const update = safe?.update;
  useLayoutEffect(() => {
    if (register && scope) return register({ ...scope, read: () => current.current });
  }, [register, scope]);
  const modalOpen = Boolean(guard.closeModal);
  useLayoutEffect(() => { update?.(); }, [update, guard.busy, guard.dirty, modalOpen]);
}
