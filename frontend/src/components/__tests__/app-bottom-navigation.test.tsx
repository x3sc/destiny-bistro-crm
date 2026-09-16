import { fireEvent, render, screen } from '@testing-library/react-native';

import { themeColors } from '../../theme/tokens';
import { AppBottomNavigation } from '../app-bottom-navigation';

const mockUser = { permissions: ['credits.read'], roles: [{ code: 'OWNER' }] };
jest.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
  hasPermission: (user: unknown, permission: string) => jest.requireActual('../../services/authorization').hasAppPermission(user, permission),
}));

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockUser.roles = [{ code: 'OWNER' }];
});

it('shows the three labeled destinations from the Stitch navigation bar', () => {
  render(<AppBottomNavigation activeItem="credits" />);

  expect(screen.getByRole('tab', { name: 'Mesas' })).toBeTruthy();
  const activeTab = screen.getByRole('tab', {
    name: 'Fiados',
    selected: true,
  });
  expect(activeTab).toHaveStyle({ backgroundColor: themeColors.surfaceAccent });
  expect(screen.getByRole('tab', { name: 'Administrativo' })).toBeTruthy();
  expect(screen.getByText('Mesas')).toBeTruthy();
  expect(screen.getByText('Fiados')).toHaveStyle({ color: themeColors.primary });
  expect(screen.getByText('Administrativo')).toBeTruthy();
});

it('replaces the current route when a destination is selected', () => {
  render(<AppBottomNavigation activeItem="tables" />);

  fireEvent.press(screen.getByRole('tab', { name: 'Fiados' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Administrativo' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Mesas' }));

  expect(mockReplace).toHaveBeenNthCalledWith(1, '/credits');
  expect(mockReplace).toHaveBeenNthCalledWith(2, '/admin');
  expect(mockReplace).toHaveBeenNthCalledWith(3, '/tables');
});

it('hides credits for waiter even with a legacy grant', () => {
  mockUser.roles = [{ code: 'WAITER' }];
  render(<AppBottomNavigation activeItem="tables" />);
  expect(screen.queryByRole('tab', { name: 'Fiados' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Mesas' })).toBeTruthy();
});
