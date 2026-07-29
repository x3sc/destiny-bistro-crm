import { StyleSheet } from 'react-native';

export const creditStyles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  balance: {
    color: '#382b25',
    fontSize: 20,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#efe4da',
    borderRadius: 999,
    color: '#6f4e37',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#76513d',
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonDanger: {
    backgroundColor: '#a13f3f',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.76,
  },
  buttonSecondary: {
    backgroundColor: '#e9ded5',
  },
  buttonSecondaryText: {
    color: '#5b4032',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#ddcbbb',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.76,
  },
  cardTitle: {
    color: '#382b25',
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
    color: '#6c5d54',
    fontSize: 15,
    lineHeight: 21,
  },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    color: '#6c5d54',
    fontSize: 15,
    padding: 18,
  },
  error: {
    backgroundColor: '#fde8e8',
    borderRadius: 12,
    color: '#8c2e2e',
    fontSize: 14,
    padding: 12,
  },
  eyebrow: {
    color: '#8a5f48',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  field: {
    backgroundColor: '#fff',
    borderColor: '#c9b3a1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#382b25',
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
    backgroundColor: '#fff3d6',
    borderRadius: 12,
    color: '#725410',
    fontSize: 14,
    padding: 12,
  },
  orderMeta: {
    color: '#6c5d54',
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
    backgroundColor: '#f7f3ed',
    flex: 1,
  },
  sectionTitle: {
    color: '#382b25',
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    color: '#382b25',
    fontSize: 30,
    fontWeight: '800',
  },
});
