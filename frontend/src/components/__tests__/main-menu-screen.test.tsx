import { fireEvent, render, screen } from '@testing-library/react-native';

import { MainMenuScreen } from '../main-menu-screen';

it('navigates to tables and credits while keeping statements disabled', () => {
  const onCredits = jest.fn();
  const onTables = jest.fn();

  render(<MainMenuScreen onCredits={onCredits} onTables={onTables} />);

  fireEvent.press(screen.getByRole('button', { name: 'Mesas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fiados' }));

  expect(onTables).toHaveBeenCalledTimes(1);
  expect(onCredits).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Em breve')).toBeTruthy();
  expect(
    screen
      .getAllByRole('button')
      .some((button) => button.props.accessibilityState?.disabled === true),
  ).toBe(true);
});
