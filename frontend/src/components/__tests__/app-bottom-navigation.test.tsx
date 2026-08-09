import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppBottomNavigation } from '../app-bottom-navigation';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

beforeEach(() => {
  mockReplace.mockClear();
});

it('shows the three destinations from the Figma navigation bar', () => {
  render(<AppBottomNavigation activeItem="credits" />);

  expect(screen.getByRole('tab', { name: 'Mesas' })).toBeTruthy();
  expect(
    screen.getByRole('tab', { name: 'Fiados', selected: true }),
  ).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Administrativo' })).toBeTruthy();
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
