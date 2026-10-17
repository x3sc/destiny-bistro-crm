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
  expect(themeRadii).toEqual({
    compact: 16,
    operationalCard: 16,
    operationalControl: 12,
    pill: 999,
    standard: 22,
  });
  expect(themeTypography.body).toEqual(
    expect.objectContaining({ fontFamily: 'WorkSans', fontSize: 16 }),
  );
  expect(themeTypography.screenTitle.fontFamily).toBe('Manrope');
});

it('uses sans-serif fallbacks for the operational families on web', () => {
  try {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
      const { themeTypography: webTypography } = jest.requireActual<typeof import('../tokens')>('../tokens');
      expect(webTypography.body.fontFamily).toContain('sans-serif');
      expect(webTypography.body.fontFamily).toContain('Work Sans');
      expect(webTypography.screenTitle.fontFamily).toContain('Manrope');
    });
  } finally {
    jest.dontMock('react-native');
  }
});
