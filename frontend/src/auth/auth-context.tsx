import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
} from '../services/auth-session';

interface AuthContextValue {
  loading: boolean;
  signIn(name: string, password: string): Promise<void>;
  signOut(): Promise<void>;
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
      });

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
  }, [apiBaseUrl, clearSession]);

  const signIn = useCallback(
    async (name: string, password: string) => {
      const session = await login(apiBaseUrl, name, password);
      await storeSession({
        expiresAt: session.expiresAt,
        token: session.token,
      });
      configureAuthenticatedFetch(session.token, () => {
        void clearSession();
      });
      setUser(session.user);
    },
    [apiBaseUrl, clearSession],
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
      user,
    }),
    [loading, signIn, signOut, user],
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
  return user?.permissions.includes(permission) === true;
}
