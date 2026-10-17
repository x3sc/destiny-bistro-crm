import { hasAppPermission } from '../services/authorization';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  loadCurrentUser,
  login,
  logout,
  type AuthUser,
} from '../services/auth-api';
import {
  clearStoredSession,
  configureAuthenticatedFetch,
  readStoredSession,
  storeSession,
  getActiveAuthToken,
} from '../services/auth-session';

interface AuthContextValue {
  loading: boolean;
  signIn(name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshSession(): Promise<void>;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  apiBaseUrl,
  children,
}: {
  apiBaseUrl: string;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshSession = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const token = getActiveAuthToken();
    if (!token) return Promise.resolve();
    const task = loadCurrentUser(apiBaseUrl).then((current) => {
      if (getActiveAuthToken() === token) setUser((previous) => JSON.stringify(previous) === JSON.stringify(current) ? previous : current);
    }, () => {}).finally(() => { if (refreshing.current === task) refreshing.current = null; });
    refreshing.current = task;
    return task;
  }, [apiBaseUrl]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshSession(); });
    return () => subscription.remove();
  }, [refreshSession]);

  const clearSession = useCallback(async () => {
    configureAuthenticatedFetch(null);
    await clearStoredSession();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      const stored = await readStoredSession();

      if (
        !stored ||
        new Date(stored.expiresAt).getTime() <= Date.now()
      ) {
        await clearSession();
        if (active) {
          setLoading(false);
        }
        return;
      }

      configureAuthenticatedFetch(stored.token, () => {
        void clearSession();
      }, () => { void refreshSession(); });

      try {
        const currentUser = await loadCurrentUser(apiBaseUrl);
        if (active) {
          setUser(currentUser);
        }
      } catch {
        await clearSession();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, [apiBaseUrl, clearSession, refreshSession]);

  const signIn = useCallback(
    async (name: string, password: string) => {
      const session = await login(apiBaseUrl, name, password);
      await storeSession({
        expiresAt: session.expiresAt,
        token: session.token,
      });
      configureAuthenticatedFetch(session.token, () => {
        void clearSession();
      }, () => { void refreshSession(); });
      setUser(session.user);
    },
    [apiBaseUrl, clearSession, refreshSession],
  );

  const signOut = useCallback(async () => {
    try {
      await logout(apiBaseUrl);
    } finally {
      await clearSession();
    }
  }, [apiBaseUrl, clearSession]);

  const value = useMemo(
    () => ({
      loading,
      signIn,
      signOut,
      refreshSession,
      user,
    }),
    [loading, signIn, signOut, user, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('AuthProvider não configurado.');
  }

  return value;
}

export function hasPermission(
  user: AuthUser | null,
  permission: string,
) {
  return hasAppPermission(user, permission);
}
