import { StyleSheet } from 'react-native';

import { themeColors } from '../theme/tokens';

export const creditStyles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  balance: {
    color: themeColors.foreground,
    fontSize: 20,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: themeColors.surfaceAccent,
    borderRadius: 999,
    color: themeColors.primary,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonDanger: {
    backgroundColor: themeColors.dangerSolid,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.76,
  },
  buttonSecondary: {
    backgroundColor: themeColors.surfaceAccent,
  },
  buttonSecondaryText: {
    color: themeColors.primaryText,
  },
  buttonText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.76,
  },
  cardTitle: {
    color: themeColors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: 18,
    maxWidth: 760,
    padding: 22,
    width: '100%',
  },
  description: {
    color: themeColors.foregroundMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  empty: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    color: themeColors.foregroundMuted,
    fontSize: 15,
    padding: 18,
  },
  error: {
    backgroundColor: themeColors.dangerSurface,
    borderRadius: 12,
    color: themeColors.dangerText,
    fontSize: 14,
    padding: 12,
  },
  eyebrow: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  field: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  filterOption: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heading: {
    gap: 8,
  },
  list: {
    gap: 12,
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 36,
  },
  notice: {
    backgroundColor: themeColors.statusAwaitingSurface,
    borderRadius: 12,
    color: themeColors.statusAwaitingText,
    fontSize: 14,
    padding: 12,
  },
  orderMeta: {
    color: themeColors.foregroundMuted,
    fontSize: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  safeArea: {
    backgroundColor: themeColors.background,
    flex: 1,
  },
  sectionTitle: {
    color: themeColors.foreground,
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    color: themeColors.foreground,
    fontSize: 30,
    fontWeight: '800',
  },
});
