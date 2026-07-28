import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f2eb',
  },
  content: {
    flex: 1,
    gap: 20,
    padding: 24,
  },
  heading: {
    gap: 8,
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
  messageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    color: '#5d514b',
    padding: 16,
  },
  categoryGrid: {
    gap: 12,
    paddingBottom: 4,
  },
  categoryRow: {
    gap: 12,
  },
  categoryCard: {
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#d8c5b8',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 112,
    padding: 16,
  },
  pressedCategoryCard: {
    backgroundColor: '#eee5de',
  },
  categoryCardText: {
    color: '#2f241f',
    fontSize: 17,
    fontWeight: '700',
  },
  categoryCount: {
    color: '#795548',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCategoryHeader: {
    gap: 12,
  },
  selectedCategoryTitle: {
    color: '#2f241f',
    fontSize: 22,
    fontWeight: '700',
  },
  productList: {
    gap: 12,
  },
  productCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16,
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    color: '#2f241f',
    fontSize: 18,
    fontWeight: '700',
  },
  quantityText: {
    color: '#795548',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 12,
    padding: 14,
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
