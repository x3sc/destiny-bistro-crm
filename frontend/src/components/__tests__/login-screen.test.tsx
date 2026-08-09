import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { getLoginLayoutMetrics, LoginScreen } from '../login-screen';

it('compresses the whole login layout on shorter screens', () => {
  const compact = getLoginLayoutMetrics(640);
  const tall = getLoginLayoutMetrics(1055);

  expect(compact.heroHeight).toBeLessThan(tall.heroHeight);
  expect(compact.logoSize).toBeLessThan(tall.logoSize);
  expect(compact.titleFontSize).toBeLessThan(tall.titleFontSize);
  expect(compact.cardPaddingTop).toBeLessThan(tall.cardPaddingTop);
  expect(compact.buttonHeight).toBeGreaterThanOrEqual(48);
});

it('submits name and password without offering account creation', async () => {
  const onLogin = jest.fn(() => Promise.resolve());

  render(<LoginScreen onLogin={onLogin} />);

  expect(screen.getByLabelText('Logo Destiny')).toBeTruthy();
  expect(screen.getByText('Desenvolvido por @destinyin.ofc')).toBeTruthy();

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
