import { Platform, StyleSheet } from 'react-native';

import { themeColors } from '../theme/tokens';

const titleFont = Platform.select({
  android: 'serif',
  default: 'Georgia',
  ios: 'Georgia',
  web: 'Georgia, serif',
});

export const deliveryOrderStyles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: themeColors.surfaceAccent,
    borderRadius: 999,
    color: themeColors.primary,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  card: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  cardHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardPressed: {
    opacity: 0.72,
  },
  cardTitle: {
    color: themeColors.foreground,
    flexShrink: 1,
    fontFamily: titleFont,
    fontSize: 21,
    fontWeight: '700',
  },
  content: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 1180,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 20,
    width: '100%',
  },
  empty: {
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    color: themeColors.foregroundMuted,
    fontSize: 15,
    padding: 20,
    textAlign: 'center',
  },
  error: {
    backgroundColor: themeColors.dangerSurface,
    borderRadius: 14,
    color: themeColors.dangerText,
    fontSize: 14,
    padding: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemMeta: {
    color: themeColors.foregroundMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  itemName: {
    color: themeColors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  itemRow: {
    borderBottomColor: themeColors.divider,
    borderBottomWidth: 1,
    gap: 5,
    paddingBottom: 12,
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 44,
  },
  meta: {
    color: themeColors.foregroundMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  safeArea: {
    backgroundColor: themeColors.primary,
    flex: 1,
  },
  scroll: {
    backgroundColor: themeColors.background,
    flex: 1,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.borderStrong,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  searchInput: {
    color: themeColors.foreground,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
  },
  sectionTitle: {
    color: themeColors.primary,
    fontFamily: titleFont,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 125,
    padding: 14,
  },
  summaryCount: {
    color: themeColors.primary,
    fontFamily: titleFont,
    fontSize: 28,
    fontWeight: '700',
  },
  summaryLabel: {
    color: themeColors.foregroundMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: themeColors.primary,
  },
  tabBar: {
    backgroundColor: themeColors.surfaceAccent,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 6,
    padding: 5,
  },
  tabText: {
    color: themeColors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  tabTextActive: {
    color: themeColors.foregroundOnPrimary,
  },
  totals: {
    backgroundColor: themeColors.surfaceAccent,
    borderRadius: 16,
    gap: 8,
    padding: 14,
  },
});
