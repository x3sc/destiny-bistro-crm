import { render, screen } from '@testing-library/react-native';

import { BrandedScreenHeader } from '../branded-screen-header';

it('uses the compact Stitch mobile header', () => {
  render(<BrandedScreenHeader title="Mesas" />);

  expect(screen.getByTestId('branded-screen-header')).toHaveStyle({
    minHeight: 56,
  });
  expect(screen.getByText('Mesas')).toHaveStyle({
    fontSize: 20,
    lineHeight: 24,
  });
});
