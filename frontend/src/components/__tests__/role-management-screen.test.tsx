import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoleEditorScreen, RoleListScreen } from '../role-management-screen';
import { RoleApiError } from '../../services/roles-api';
const role = { id: 'role', code: 'CUSTOM_role', name: 'Atendimento', description: null, protected: false, version: 1, userCount: 3,
  permissions: ['counter-sales.read'], canEdit: true, canDelete: false };
const permissions = [{ code: 'counter-sales.read', name: 'Visualizar Balcão', group: 'counter-sales', dependencies: [], ownerOnly: false },
  { code: 'counter-sales.write', name: 'Operar Balcão', group: 'counter-sales', dependencies: ['counter-sales.read'], ownerOnly: false }];
const loadRequest = async () => ({ roles: [role], permissions });
jest.mock('expo-router', () => ({ useFocusEffect: (callback: React.EffectCallback) => {
  const React = jest.requireActual('react'); React.useEffect(callback, [callback]);
} }));
it('lists affected users and blocks deleting an assigned role', async () => {
  render(<RoleListScreen apiBaseUrl="http://localhost:3333" canManage loadRequest={loadRequest} onBack={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} />);
  await screen.findByText('Atendimento');
  expect(screen.getByText('3 usuários vinculados')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Excluir Atendimento' })).toBeDisabled();
});
it('requires review before saving permission changes and displays affected users', async () => {
  const saveRequest = jest.fn(async () => role);
  render(<RoleEditorScreen apiBaseUrl="http://localhost:3333" canManage roleId="role" loadRequest={loadRequest}
    saveRequest={saveRequest} onBack={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole('checkbox', { name: 'Operar Balcão' });
  fireEvent.press(screen.getByRole('checkbox', { name: 'Operar Balcão' }));
  expect(screen.getByRole('checkbox', { name: 'Visualizar Balcão' })).toBeChecked();
  fireEvent.press(screen.getByRole('button', { name: 'Revisar alterações' }));
  expect(saveRequest).not.toHaveBeenCalled();
  expect(screen.getByText('Esta alteração afeta 3 usuários.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar e salvar cargo' }));
  await screen.findByRole('button', { name: 'Revisar alterações' });
  expect(saveRequest).toHaveBeenCalledWith('http://localhost:3333', expect.objectContaining({ permissions: ['counter-sales.read', 'counter-sales.write'] }), expect.objectContaining({ version: 1 }));
});
it('locks a stale permission editor until roles are reloaded', async () => {
  render(<RoleEditorScreen apiBaseUrl="http://localhost:3333" canManage roleId="role" loadRequest={loadRequest}
    saveRequest={async () => { throw new RoleApiError(409); }} onBack={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.press(await screen.findByRole('checkbox', { name: 'Operar Balcão' }));
  fireEvent.press(screen.getByRole('button', { name: 'Revisar alterações' }));
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar e salvar cargo' }));
  await screen.findByRole('button', { name: 'Recarregar cargos' });
  expect(screen.queryByRole('button', { name: 'Revisar alterações' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Operar Balcão' })).toBeDisabled();
});
it('hides role administration and does not request data without permission', () => {
  const request = jest.fn(loadRequest);
  render(<RoleListScreen apiBaseUrl="http://localhost:3333" canManage={false} loadRequest={request}
    onBack={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} />);
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Novo cargo' })).toBeNull();
});
