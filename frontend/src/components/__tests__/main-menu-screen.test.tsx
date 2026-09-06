import { fireEvent, render, screen } from '@testing-library/react-native';

import { MainMenuScreen } from '../main-menu-screen';

it('navigates to tables, credits, delivery and administration', () => {
  const onAdmin = jest.fn();
  const onCredits = jest.fn();
  const onDeliveries = jest.fn();
  const onKitchen = jest.fn();
  const onTables = jest.fn();

  render(
    <MainMenuScreen
      onAdmin={onAdmin}
      onCredits={onCredits}
      onDeliveries={onDeliveries}
      onKitchen={onKitchen}
      onTables={onTables}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mesas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fiados' }));
  fireEvent.press(screen.getByRole('button', { name: 'Delivery' }));
  fireEvent.press(screen.getByRole('button', { name: 'Cozinha' }));
  fireEvent.press(screen.getByRole('button', { name: 'Administrativo' }));

  expect(onTables).toHaveBeenCalledTimes(1);
  expect(onCredits).toHaveBeenCalledTimes(1);
  expect(onDeliveries).toHaveBeenCalledTimes(1);
  expect(onKitchen).toHaveBeenCalledTimes(1);
  expect(onAdmin).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Em breve')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
});

it('shows only permitted areas and logs out the identified user', () => {
  const onLogout = jest.fn();

  render(
    <MainMenuScreen
      canAccessCredits={false}
      canAccessAdmin={false}
      canAccessDeliveries={false}
      canAccessKitchen={false}
      canAccessTables
      establishmentName="Destiny Centro"
      onAdmin={jest.fn()}
      onCredits={jest.fn()}
      onDeliveries={jest.fn()}
      onKitchen={jest.fn()}
      onLogout={onLogout}
      onTables={jest.fn()}
      userName="Cozinha"
    />,
  );

  expect(screen.getByText('Mesas')).toBeTruthy();
  expect(screen.queryByText('Fiados')).toBeNull();
  expect(screen.queryByText('Delivery')).toBeNull();
  expect(screen.queryByText('Cozinha')).toBeNull();
  expect(screen.queryByText('Administrativo')).toBeNull();
  expect(
    screen.getByText('Olá, bem-vindo(a), Cozinha, ao seu menu principal'),
  ).toBeTruthy();
  expect(screen.getByText('Conectado como Cozinha')).toBeTruthy();
  expect(screen.getByText('Destiny Centro')).toBeTruthy();
  fireEvent.press(screen.getByText('Sair'));
  expect(onLogout).toHaveBeenCalledTimes(1);
});
