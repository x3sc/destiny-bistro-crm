import {
  themeRadii,
  themeSpacing,
  themeTypography,
} from '../tokens';

it('exposes the mobile layout tokens defined by the Stitch design system', () => {
  expect(themeSpacing).toEqual(
    expect.objectContaining({
      base: 4,
      lg: 20,
      md: 16,
      mobileMargin: 20,
      sm: 12,
      touchTargetMin: 44,
      xl: 24,
      xs: 8,
      xxl: 32,
    }),
  );
  expect(themeRadii).toEqual({ compact: 16, pill: 999, standard: 22 });
  expect(themeTypography.body).toEqual(
    expect.objectContaining({ fontFamily: 'Roboto', fontSize: 16 }),
  );
});
