import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LoginScreen } from '../login-screen';

it('submits name and password without offering account creation', async () => {
  const onLogin = jest.fn(() => Promise.resolve());

  render(<LoginScreen onLogin={onLogin} />);

  fireEvent.changeText(screen.getByTestId('login-name'), 'Gustavo');
  fireEvent.changeText(screen.getByTestId('login-password'), 'password-ok');
  fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() => {
    expect(onLogin).toHaveBeenCalledWith('Gustavo', 'password-ok');
  });
  expect(screen.queryByText(/criar conta/iu)).toBeNull();
});

it('shows the generic login failure returned by the API', async () => {
  const onLogin = jest.fn(() =>
    Promise.reject(new Error('Nome ou senha inválidos.')),
  );

  render(<LoginScreen onLogin={onLogin} />);

  fireEvent.changeText(screen.getByTestId('login-name'), 'Gustavo');
  fireEvent.changeText(screen.getByTestId('login-password'), 'incorrect');
  fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByText('Nome ou senha inválidos.')).toBeTruthy();
});
