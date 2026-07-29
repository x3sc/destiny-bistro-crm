import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f2eb',
  },
  content: {
    gap: 20,
    padding: 24,
  },
  eyebrow: {
    color: '#795548',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#2f241f',
    fontSize: 32,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 8,
    padding: 20,
  },
  comandaNumber: {
    color: '#2f241f',
    fontSize: 24,
    fontWeight: '700',
  },
  comandaName: {
    color: '#795548',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#2f241f',
    fontSize: 20,
    fontWeight: '700',
  },
  itemDivisionTitle: {
    color: '#795548',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  description: {
    color: '#5d514b',
    fontSize: 16,
    lineHeight: 24,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    minHeight: 240,
  },
  actions: {
    gap: 12,
  },
  error: {
    backgroundColor: '#f8d7da',
    borderRadius: 12,
    color: '#842029',
    padding: 16,
  },
  notice: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    color: '#664d03',
    padding: 16,
  },
  itemRow: {
    borderTopColor: '#eee2d7',
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 14,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  itemName: {
    color: '#2f241f',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  confirmedBadge: {
    backgroundColor: '#d1e7dd',
    borderRadius: 999,
    color: '#0f5132',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quantityControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  quantityText: {
    color: '#2f241f',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  confirmSmallButton: {
    backgroundColor: '#2f6f4e',
  },
  dangerSmallButton: {
    backgroundColor: '#842029',
  },
  totalText: {
    color: '#2f241f',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 12,
    padding: 16,
  },
  dangerButton: {
    backgroundColor: '#842029',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#6f4e37',
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#6f4e37',
  },
});
