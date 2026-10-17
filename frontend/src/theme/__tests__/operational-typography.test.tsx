import { render, screen } from '@testing-library/react-native';

import {
  OperationalText,
  OperationalTypographyProvider,
} from '../operational-typography';

let mockFontsLoaded = false;

jest.mock('expo-font', () => ({
  useFonts: () => [mockFontsLoaded],
}));

it('renders content immediately with the platform fallback while fonts load', () => {
  mockFontsLoaded = false;

  render(
    <OperationalTypographyProvider>
      <OperationalText fontRole="heading">Mesas</OperationalText>
    </OperationalTypographyProvider>,
  );

  expect(screen.getByText('Mesas')).not.toHaveStyle({ fontFamily: 'Manrope' });
});

it('uses the local operational families after they load', () => {
  mockFontsLoaded = true;

  render(
    <OperationalTypographyProvider>
      <OperationalText fontRole="heading">Catálogo</OperationalText>
      <OperationalText>Escolha os produtos</OperationalText>
    </OperationalTypographyProvider>,
  );

  expect(screen.getByText('Catálogo')).toHaveStyle({ fontFamily: 'Manrope' });
  expect(screen.getByText('Escolha os produtos')).toHaveStyle({
    fontFamily: 'WorkSans',
  });
});
