import { StyleSheet } from 'react-native';

import { themeColors } from '../theme/tokens';

export const creditStyles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  balance: {
    color: themeColors.foreground,
    fontSize: 18,
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
    backgroundColor: themeColors.accent,
    borderRadius: 23,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonDanger: {
    backgroundColor: themeColors.dangerSolid,
  },
  buttonDangerText: {
    color: themeColors.foregroundOnPrimary,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    backgroundColor: themeColors.accentPressed,
  },
  buttonSecondary: {
    backgroundColor: themeColors.surfaceAccent,
  },
  buttonSecondaryText: {
    color: themeColors.primaryText,
  },
  buttonText: {
    color: themeColors.foreground,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    minHeight: 82,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cardPressed: {
    opacity: 0.76,
  },
  cardTitle: {
    color: themeColors.foreground,
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    alignSelf: 'center',
    backgroundColor: themeColors.background,
    flexGrow: 1,
    gap: 16,
    maxWidth: 760,
    paddingBottom: 36,
    paddingHorizontal: 25,
    paddingTop: 22,
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
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    color: themeColors.foreground,
    fontSize: 15,
    minHeight: 48,
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
    backgroundColor: themeColors.primary,
    flex: 1,
  },
  scroll: {
    backgroundColor: themeColors.background,
    flex: 1,
  },
  sectionTitle: {
    color: themeColors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  title: {
    color: themeColors.foreground,
    fontSize: 26,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  summaryCount: {
    color: themeColors.foreground,
    fontSize: 18,
    fontWeight: '300',
  },
  summaryLabel: {
    color: themeColors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryValue: {
    color: themeColors.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
});
