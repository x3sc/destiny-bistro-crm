import { render } from '@testing-library/react-native';
import { AuthorizationSessionBoundary } from '../authorization-session-boundary';
const mockDispatch = jest.fn();
const mockRefresh = jest.fn(async () => {});
const mockRoot = { isReady: () => true, getRootState: () => ({ key: 'root', routes: [{ name: 'admin/users/index' }] }), dispatch: mockDispatch };
let mockPermissions = ['users.manage'];
jest.mock('expo-router', () => ({ usePathname: () => '/admin/users', useNavigationContainerRef: () => mockRoot }));
jest.mock('../../auth/auth-context', () => ({ useAuth: () => ({ user: { permissions: mockPermissions }, refreshSession: mockRefresh }) }));
const mockComplete = (action: () => void) => action();
jest.mock('../safe-navigation', () => ({ useSafeNavigationCompletion: () => mockComplete }));
it('clears protected screen history when access is revoked, not on initial load', () => {
  const view = render(<AuthorizationSessionBoundary />);
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockPermissions = [];
  view.rerender(<AuthorizationSessionBoundary />);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'RESET', target: 'root', payload: { index: 0, routes: [{ name: 'index' }] } });
});
