import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { UserRoleAssignmentScreen } from '../user-role-assignment-screen';
import { UserApiError } from '../../services/users-api';

jest.mock('expo-router', () => ({ useFocusEffect: (callback: React.EffectCallback) => {
  const React = jest.requireActual('react'); React.useEffect(callback, [callback]);
} }));
const roles = [
  { id: 'old', code: 'WAITER', name: 'Garçom', permissions: ['comandas.read'] },
  { id: 'new', code: 'CUSTOM', name: 'Balcão somente', permissions: ['counter-sales.read'] },
];
const data = { users: [{ id: 'user', name: 'Operador', active: true, roles: [roles[0]],
  roleVersion: 4, permissions: ['comandas.read'], canReassign: true }], roles };
it('reviews a single role replacement and sends the expected binding version exactly once', async () => {
  const onSaved = jest.fn();
  const saveRequest = jest.fn(async () => data.users[0]);
  render(<UserRoleAssignmentScreen userId="user" canManage apiBaseUrl="http://localhost:3333"
    loadRequest={async () => data} saveRequest={saveRequest} onBack={jest.fn()} onSaved={onSaved} />);
  fireEvent.press(await screen.findByRole('radio', { name: 'Balcão somente' }));
  fireEvent.press(screen.getByRole('button', { name: 'Revisar troca de cargo' }));
  expect(saveRequest).not.toHaveBeenCalled();
  const confirm = screen.getByRole('button', { name: 'Confirmar troca de cargo' });
  fireEvent.press(confirm); fireEvent.press(confirm);
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(saveRequest).toHaveBeenCalledTimes(1);
  expect(saveRequest).toHaveBeenCalledWith('http://localhost:3333', 'user', 'new', 4);
});
it('requires reload after a stale role binding instead of resubmitting', async () => {
  const saveRequest = jest.fn(async () => { throw new UserApiError(409); });
  render(<UserRoleAssignmentScreen userId="user" canManage apiBaseUrl="http://localhost:3333"
    loadRequest={async () => data} saveRequest={saveRequest} onBack={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.press(await screen.findByRole('radio', { name: 'Balcão somente' }));
  fireEvent.press(screen.getByRole('button', { name: 'Revisar troca de cargo' }));
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar troca de cargo' }));
  expect(await screen.findByRole('button', { name: 'Recarregar usuários' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Revisar troca de cargo' })).toBeNull();
});
it('does not load users without administrative permission', () => {
  const loadRequest = jest.fn(async () => data);
  render(<UserRoleAssignmentScreen userId="user" canManage={false} apiBaseUrl="http://localhost:3333"
    loadRequest={loadRequest} onBack={jest.fn()} onSaved={jest.fn()} />);
  expect(loadRequest).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Revisar troca de cargo' })).toBeNull();
});
