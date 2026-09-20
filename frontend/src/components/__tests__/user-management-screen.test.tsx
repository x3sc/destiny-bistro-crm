import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { UserManagementScreen } from '../user-management-screen';
import { UserApiError } from '../../services/users-api';

const roles = [
  { id: 'owner', code: 'OWNER', name: 'Dono' },
  { id: 'manager', code: 'MANAGER', name: 'Gerente' },
  { id: 'waiter', code: 'WAITER', name: 'Garçom' },
  { id: 'kitchen', code: 'KITCHEN', name: 'Cozinha' },
];
const user = { id: 'user', name: 'Ana', active: true, roles: [roles[0], roles[2]] };
const created = { id: 'new', name: 'Bruno', active: true, roles: [roles[2]] };
function setup(overrides: Partial<React.ComponentProps<typeof UserManagementScreen>> = {}) {
  const loadRequest = jest.fn().mockResolvedValue({ users: [user], roles });
  const createRequest = jest.fn().mockResolvedValue(created);
  render(<UserManagementScreen apiBaseUrl="http://localhost:3333" canManageUsers loadRequest={loadRequest} createRequest={createRequest} onBack={jest.fn()} {...overrides} />);
  return { loadRequest, createRequest };
}
async function openForm() {
  await screen.findByText('Ana');
  fireEvent.press(screen.getByRole('button', { name: 'Novo usuário' }));
}
function fillForm() {
  fireEvent.changeText(screen.getByLabelText('Nome de acesso'), 'Bruno');
  fireEvent.changeText(screen.getByLabelText('Senha'), 'test-password');
  fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'test-password');
  fireEvent.press(screen.getByRole('radio', { name: 'Garçom' }));
}

it('lists existing multiple roles and creates a user without changing the owner session', async () => {
  const { createRequest } = setup();
  await screen.findByText('Ana');
  expect(screen.getByText('Dono')).toBeTruthy();
  expect(screen.getByText('Garçom')).toBeTruthy();
  await openForm();
  expect(screen.getAllByRole('radio').every((radio) => !radio.props.accessibilityState.checked)).toBe(true);
  fillForm();
  fireEvent.press(screen.getByRole('radio', { name: 'Gerente' }));
  expect(screen.getByRole('radio', { name: 'Garçom' }).props.accessibilityState.checked).toBe(false);
  fireEvent.press(screen.getByRole('radio', { name: 'Garçom' }));
  fireEvent.press(screen.getByRole('button', { name: 'Criar usuário' }));
  await screen.findByText('Usuário criado com sucesso.');
  expect(screen.getByText('Bruno')).toBeTruthy();
  expect(createRequest).toHaveBeenCalledWith('http://localhost:3333', { name: 'Bruno', password: 'test-password', roleCode: 'WAITER' });
  fireEvent.press(screen.getByRole('button', { name: 'Novo usuário' }));
  expect(screen.getByLabelText('Senha').props.value).toBe('');
});

it('validates required fields, mismatch and requires one role', async () => {
  const { createRequest } = setup(); await openForm();
  fireEvent.press(screen.getByRole('button', { name: 'Criar usuário' }));
  expect(screen.getByText('Selecione um perfil.')).toBeTruthy();
  fillForm();
  fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'different-password');
  fireEvent.press(screen.getByRole('button', { name: 'Criar usuário' }));
  expect(screen.getByText('As senhas não coincidem.')).toBeTruthy();
  expect(createRequest).not.toHaveBeenCalled();
});

it('displays a duplicate name error and clears passwords on cancel', async () => {
  setup({ createRequest: jest.fn().mockRejectedValue(new UserApiError(409)) }); await openForm(); fillForm();
  fireEvent.press(screen.getByRole('button', { name: 'Criar usuário' }));
  await screen.findByText('Este nome de acesso já está em uso.');
  fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }));
  expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.press(screen.getByRole('button', { name: 'Novo usuário' }));
  expect(screen.getByLabelText('Senha').props.value).toBe('');
  expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(true);
});

it('blocks unauthorized direct access without any API calls', () => {
  const { loadRequest } = setup({ canManageUsers: false });
  expect(screen.getByText('Acesso exclusivo do dono.')).toBeTruthy();
  expect(loadRequest).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Novo usuário' })).toBeNull();
});

it('prevents duplicate submission while saving', async () => {
  let resolve!: (value: typeof created) => void;
  const createRequest = jest.fn(() => new Promise<typeof created>((done) => { resolve = done; }));
  setup({ createRequest }); await openForm(); fillForm();
  const button = screen.getByRole('button', { name: 'Criar usuário' });
  fireEvent.press(button); fireEvent.press(button);
  expect(createRequest).toHaveBeenCalledTimes(1);
  await act(async () => resolve(created));
  await screen.findByText('Usuário criado com sucesso.');
});

it('retries a failed list request and displays empty state', async () => {
  const loadRequest = jest.fn().mockRejectedValueOnce(new Error()).mockResolvedValue({ users: [], roles });
  setup({ loadRequest });
  fireEvent.press(await screen.findByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(screen.getByText('Nenhum usuário cadastrado.')).toBeTruthy());
});
