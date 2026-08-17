import { StyleSheet } from 'react-native';

import { themeColors } from '../theme/tokens';

export const deliveryStyles = StyleSheet.create({
  actions: {
    gap: 10,
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
  badgeClosed: {
    backgroundColor: themeColors.statusFreeSurface,
    color: themeColors.statusFreeText,
  },
  badgeOpen: {
    backgroundColor: themeColors.statusOpenSurface,
    color: themeColors.statusOpenText,
  },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.accent,
    borderRadius: 23,
    justifyContent: 'center',
    minHeight: 48,
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
    backgroundColor: themeColors.accentPressed,
  },
  buttonSecondary: {
    backgroundColor: themeColors.surfaceAccent,
  },
  buttonSecondaryText: {
    color: themeColors.primaryText,
  },
  buttonText: {
    color: themeColors.foregroundOnPrimary,
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
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  divider: {
    backgroundColor: themeColors.divider,
    height: 1,
    marginVertical: 4,
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
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: themeColors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  list: {
    gap: 12,
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 36,
  },
  meta: {
    color: themeColors.foregroundSoft,
    fontSize: 13,
  },
  methodOption: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  methodOptionSelected: {
    backgroundColor: themeColors.surfaceAccent,
    borderColor: themeColors.primary,
  },
  methodOptionText: {
    color: themeColors.foregroundMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  methodOptionTextSelected: {
    color: themeColors.primary,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notice: {
    backgroundColor: themeColors.statusAwaitingSurface,
    borderRadius: 12,
    color: themeColors.statusAwaitingText,
    fontSize: 14,
    padding: 12,
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
  summaryCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  totalLabel: {
    color: themeColors.foregroundMuted,
    fontSize: 15,
  },
  totalLabelEmphasis: {
    color: themeColors.foreground,
    fontSize: 17,
    fontWeight: '800',
  },
  totalValue: {
    color: themeColors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  totalValueEmphasis: {
    color: themeColors.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  totalValueNegative: {
    color: themeColors.dangerText,
  },
});
