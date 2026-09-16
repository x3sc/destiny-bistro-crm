import { render, screen } from '@testing-library/react-native';
import CreditsLayout from '../../app/credits/_layout';
import ConvertCredit from '../../app/comandas/[comandaId]/credit';

const mockUser = { permissions: ['credits.read', 'credits.write'], roles: [{ code: 'WAITER' }] };
jest.mock('@/auth/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
  hasPermission: (user: unknown, permission: string) => jest.requireActual('../../services/authorization').hasAppPermission(user, permission),
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>redirect:{href}</Text>,
    Stack: () => <Text>credit-stack</Text>,
    useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ comandaId: 'comanda' }),
  };
});
jest.mock('@/components/credit-customer-picker-screen', () => ({
  CreditCustomerPickerScreen: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>credit-picker</Text>;
  },
}));

it.each(['WAITER', 'KITCHEN'])('blocks direct credit URLs for %s before mounting screens', (code) => {
  mockUser.roles = [{ code }];
  const view = render(<CreditsLayout />);
  expect(screen.getByText('redirect:/')).toBeTruthy();
  expect(screen.queryByText('credit-stack')).toBeNull();
  view.unmount();
  render(<ConvertCredit />);
  expect(screen.getByText('redirect:/')).toBeTruthy();
  expect(screen.queryByText('credit-picker')).toBeNull();
});
it.each(['OWNER', 'MANAGER'])('allows credit routes for %s', (code) => {
  mockUser.roles = [{ code }];
  const view = render(<CreditsLayout />);
  expect(screen.getByText('credit-stack')).toBeTruthy();
  view.unmount();
  render(<ConvertCredit />);
  expect(screen.getByText('credit-picker')).toBeTruthy();
});
