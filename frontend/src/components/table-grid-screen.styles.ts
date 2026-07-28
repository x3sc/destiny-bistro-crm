import { StyleSheet } from 'react-native';

export const tableStatusStyles = StyleSheet.create({
  AWAITING_CHECK: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffca2c',
  },
  FREE: {
    backgroundColor: '#d1e7dd',
    borderColor: '#75b798',
  },
  OPEN: {
    backgroundColor: '#f8d7da',
    borderColor: '#ea868f',
  },
});

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
  feedback: {
    gap: 16,
  },
  message: {
    color: '#5d514b',
    fontSize: 16,
  },
  messageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    color: '#5d514b',
    padding: 16,
  },
  errorMessage: {
    backgroundColor: '#f8d7da',
    color: '#842029',
  },
  tableGrid: {
    gap: 12,
  },
  tableRow: {
    gap: 12,
  },
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 108,
    padding: 16,
  },
  tableNumber: {
    color: '#2f241f',
    fontSize: 20,
    fontWeight: '700',
  },
  comandaNumber: {
    color: '#5d514b',
    fontSize: 14,
  },
  comandaName: {
    color: '#2f241f',
    fontSize: 16,
    fontWeight: '700',
  },
  tableCardPressed: {
    opacity: 0.75,
  },
  tableStatus: {
    color: '#5d514b',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6f4e37',
    borderRadius: 12,
    padding: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
