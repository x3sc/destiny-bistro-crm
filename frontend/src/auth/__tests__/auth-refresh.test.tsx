import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth-context';
import { loadCurrentUser } from '../../services/auth-api';
import { configureAuthenticatedFetch, getActiveAuthToken } from '../../services/auth-session';
import type { AuthUser } from '../../services/auth-api';

jest.mock('../../services/auth-api', () => ({ loadCurrentUser: jest.fn(), login: jest.fn(), logout: jest.fn() }));
jest.mock('../../services/auth-session', () => ({ configureAuthenticatedFetch: jest.fn(), getActiveAuthToken: jest.fn(),
  readStoredSession: jest.fn(async () => ({ token: 'current', expiresAt: '2099-01-01' })),
  clearStoredSession: jest.fn(), storeSession: jest.fn() }));
const user: AuthUser = { id: 'one', name: 'Operator', establishment: { id: 'tenant', name: 'Bistro' }, roles: [], permissions: ['counter-sales.read'] };
let context: ReturnType<typeof useAuth>;
function Probe() { const value = useAuth(); useEffect(() => { context = value; }, [value]); return null; }
it('deduplicates simultaneous permission refreshes and applies revocation without logout', async () => {
  jest.mocked(getActiveAuthToken).mockReturnValue('current');
  jest.mocked(loadCurrentUser).mockResolvedValueOnce(user);
  render(<AuthProvider apiBaseUrl="http://localhost:3333"><Probe /></AuthProvider>);
  await waitFor(() => expect(context.loading).toBe(false));
  let finish!: (user: AuthUser) => void;
  jest.mocked(loadCurrentUser).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = context.refreshSession(); second = context.refreshSession(); });
  expect(first).toBe(second);
  expect(loadCurrentUser).toHaveBeenCalledTimes(2);
  await act(async () => { finish({ ...user, permissions: [] }); await first; });
  expect(context.user?.permissions).toEqual([]);
  expect(context.user?.id).toBe('one');
  expect(configureAuthenticatedFetch).not.toHaveBeenCalledWith(null);
});
