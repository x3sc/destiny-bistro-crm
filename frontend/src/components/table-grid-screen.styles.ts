import { StyleSheet } from 'react-native';

import { themeColors } from '../theme/tokens';

export const tableStatusBadgeStyles = StyleSheet.create({
  AWAITING_CHECK: {
    backgroundColor: themeColors.statusAwaitingBadge,
    borderColor: themeColors.statusAwaitingBorder,
    color: themeColors.statusAwaitingText,
  },
  FREE: {
    backgroundColor: themeColors.statusFreeBadge,
    borderColor: themeColors.statusFreeBorder,
    color: themeColors.statusFreeText,
  },
  OPEN: {
    backgroundColor: themeColors.statusOpenBadge,
    borderColor: themeColors.statusOpenBorder,
    color: themeColors.statusOpenText,
  },
});

export const tableStatusCardStyles = StyleSheet.create({
  AWAITING_CHECK: {
    backgroundColor: themeColors.statusAwaitingSurface,
    borderColor: themeColors.statusAwaitingBorder,
  },
  FREE: {
    backgroundColor: themeColors.statusFreeSurface,
    borderColor: themeColors.statusFreeBorder,
  },
  OPEN: {
    backgroundColor: themeColors.statusOpenSurface,
    borderColor: themeColors.statusOpenBorder,
  },
});

export const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: themeColors.primary,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    backgroundColor: themeColors.background,
    gap: 10,
    maxWidth: 1180,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingVertical: 6,
  },
  headingCopy: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    color: themeColors.titleEyebrow,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: themeColors.foreground,
    fontSize: 22,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  summaryLabel: {
    color: themeColors.foregroundSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    color: themeColors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 13,
  },
  searchInput: {
    color: themeColors.foregroundBody,
    flex: 1,
    fontSize: 14,
    paddingVertical: 9,
  },
  filterChips: {
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingRight: 4,
  },
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
    overflow: 'hidden',
  },
  filterScroll: {
    height: 48,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 16,
  },
  activeFilterChip: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  filterChipText: {
    color: themeColors.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilterChipText: {
    color: themeColors.foregroundOnPrimary,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  feedback: {
    gap: 14,
  },
  message: {
    color: themeColors.message,
    fontSize: 14,
  },
  messageCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: themeColors.message,
    padding: 15,
  },
  errorMessage: {
    backgroundColor: themeColors.dangerSurface,
    borderColor: themeColors.dangerBorder,
    color: themeColors.dangerText,
  },
  tableGrid: {
    gap: 9,
    paddingBottom: 4,
    paddingTop: 4,
  },
  tableList: {
    flex: 1,
    minHeight: 0,
  },
  tableRow: {
    gap: 9,
  },
  tableCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    minHeight: 132,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tableCardHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  tableNumber: {
    color: themeColors.foreground,
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  tableStatus: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '62%',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  comandaName: {
    color: themeColors.foregroundBody,
    fontSize: 12,
  },
  comandaNumber: {
    borderTopColor: themeColors.divider,
    borderTopWidth: 1,
    color: themeColors.foregroundBody,
    fontSize: 12,
    marginTop: 'auto',
    paddingTop: 7,
  },
  openComandaAction: {
    color: themeColors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 'auto',
  },
  tableCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  emptyResults: {
    borderColor: themeColors.borderStrong,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    color: themeColors.foregroundSoft,
    paddingHorizontal: 16,
    paddingVertical: 30,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 45,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButton: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderColor: themeColors.borderStrong,
    minHeight: 44,
    paddingVertical: 7,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    color: themeColors.foregroundOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: themeColors.primary,
    fontSize: 12,
  },
});
