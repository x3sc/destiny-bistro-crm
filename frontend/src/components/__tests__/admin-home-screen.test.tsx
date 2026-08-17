import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AdminHomeScreen } from '../admin-home-screen';

it('opens the daily statement and menu management', () => {
  const onBack = jest.fn();
  const onMenu = jest.fn();
  const onInventory = jest.fn();
  const onStatement = jest.fn();

  render(
    <AdminHomeScreen
      bottomNavigation={<Text>Navbar administrativa</Text>}
      canManageMenu
      canReadInventory
      canReadStatements
      onBack={onBack}
      onMenu={onMenu}
      onInventory={onInventory}
      onStatement={onStatement}
    />,
  );

  expect(screen.getByText('Destiny Bistro CRM')).toBeTruthy();
  expect(screen.getByText('Navbar administrativa')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Extrato do dia' }));
  fireEvent.press(screen.getByRole('button', { name: 'Cardápio' }));

  expect(onStatement).toHaveBeenCalledTimes(1);
  expect(onMenu).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Estoque' }));
  expect(onInventory).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('hides administrative areas without their permissions', () => {
  render(
    <AdminHomeScreen
      canManageMenu={false}
      canReadInventory={false}
      canReadStatements
      onBack={jest.fn()}
      onMenu={jest.fn()}
      onInventory={jest.fn()}
      onStatement={jest.fn()}
    />,
  );

  expect(screen.getByText('Extrato do dia')).toBeTruthy();
  expect(screen.queryByText('Cardápio')).toBeNull();
});
