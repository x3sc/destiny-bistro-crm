import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScreenBackButton } from '../screen-back-button';

it('returns to the previous screen from the top arrow', () => {
  const onPress = jest.fn();

  render(<ScreenBackButton onPress={onPress} />);

  const backButton = screen.getByRole('button', { name: 'Voltar' });

  fireEvent.press(backButton);

  expect(onPress).toHaveBeenCalledTimes(1);
});
