import { fireEvent, render, screen } from '@testing-library/react-native';

import { MainMenuScreen } from '../main-menu-screen';

it('navigates to tables, credits and statements', () => {
  const onCredits = jest.fn();
  const onStatements = jest.fn();
  const onTables = jest.fn();

  render(
    <MainMenuScreen
      onCredits={onCredits}
      onStatements={onStatements}
      onTables={onTables}
    />,
  );

  fireEvent.press(screen.getByRole('button', { name: 'Mesas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Fiados' }));
  fireEvent.press(screen.getByRole('button', { name: 'Extratos' }));

  expect(onTables).toHaveBeenCalledTimes(1);
  expect(onCredits).toHaveBeenCalledTimes(1);
  expect(onStatements).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Em breve')).toBeNull();
});
