import { loadProducts } from '../products-api';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = mockFetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  mockFetch.mockReset();
});

it('loads active products', async () => {
  const products = [
    {
      category: 'CLASSIC_BURGERS',
      id: 'coffee-id',
      name: 'Café',
      priceCents: 600,
    },
    {
      category: 'BEVERAGES',
      id: 'water-id',
      name: 'Água',
      priceCents: 500,
    },
  ];
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ products }),
    ok: true,
  });

  await expect(loadProducts('http://192.168.0.10:3333/')).resolves.toEqual(products);
  expect(mockFetch).toHaveBeenCalledWith('http://192.168.0.10:3333/products');
});

it('rejects unsuccessful responses', async () => {
  mockFetch.mockResolvedValueOnce({ ok: false });

  await expect(loadProducts('http://192.168.0.10:3333')).rejects.toThrow(
    'Products request failed',
  );
});

it('rejects malformed responses', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ products: [{ id: 'invalid' }] }),
    ok: true,
  });

  await expect(loadProducts('http://192.168.0.10:3333')).rejects.toThrow(
    'Invalid products response',
  );
});
