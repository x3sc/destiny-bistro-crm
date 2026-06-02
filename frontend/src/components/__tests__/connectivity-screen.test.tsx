import { render, screen } from '@testing-library/react-native';

import { ConnectivityScreen } from '../connectivity-screen';

const mockFetch = jest.fn();

globalThis.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

it('shows a configuration error when the API URL is absent', () => {
  render(<ConnectivityScreen apiBaseUrl="" />);

  expect(
    screen.getByText('Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo.'),
  ).toBeOnTheScreen();
  expect(mockFetch).not.toHaveBeenCalled();
});

it('shows loading while the API request is pending', () => {
  mockFetch.mockReturnValue(new Promise(() => undefined));

  render(<ConnectivityScreen apiBaseUrl="http://192.168.0.10:3333" />);

  expect(screen.getByText('Verificando...')).toBeOnTheScreen();
});

it('shows API and MySQL as connected', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

  render(<ConnectivityScreen apiBaseUrl="http://192.168.0.10:3333/" />);

  expect(await screen.findAllByText('Conectado')).toHaveLength(2);
  expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://192.168.0.10:3333/health');
  expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://192.168.0.10:3333/ready');
});

it('shows an unavailable API without checking MySQL', async () => {
  mockFetch.mockRejectedValueOnce(new Error('offline'));

  render(<ConnectivityScreen apiBaseUrl="http://192.168.0.10:3333" />);

  expect(await screen.findByText('Indisponível')).toBeOnTheScreen();
  expect(screen.getByText('Não verificado')).toBeOnTheScreen();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('shows an unavailable MySQL database after the API responds', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });

  render(<ConnectivityScreen apiBaseUrl="http://192.168.0.10:3333" />);

  expect(await screen.findByText('Indisponível')).toBeOnTheScreen();
  expect(screen.getByText('Conectado')).toBeOnTheScreen();
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
