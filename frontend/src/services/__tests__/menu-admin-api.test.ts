import {
  createMenuCategory,
  createMenuProduct,
  deleteMenuProduct,
  loadAdminMenu,
} from '../menu-admin-api';

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

const category = {
  active: true,
  id: 'category-id',
  name: 'Bebidas',
  products: [
    {
      active: true,
      description: 'Copo 300 ml',
      id: 'product-id',
      name: 'Suco de laranja',
      priceCents: 900,
    },
  ],
};

it('loads the complete administrative menu', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ categories: [category] }),
    ok: true,
  });

  await expect(loadAdminMenu('http://localhost:3333/')).resolves.toEqual([
    category,
  ]);
  expect(mockFetch).toHaveBeenCalledWith('http://localhost:3333/admin/menu');
});

it('creates categories and products using integer cents', async () => {
  mockFetch
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ category }),
      ok: true,
    })
    .mockResolvedValueOnce({
      json: () => Promise.resolve({ product: category.products[0] }),
      ok: true,
    });

  await createMenuCategory('http://localhost:3333', { name: 'Bebidas' });
  await createMenuProduct('http://localhost:3333', {
    categoryId: 'category-id',
    description: 'Copo 300 ml',
    name: 'Suco de laranja',
    priceCents: 900,
  });

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:3333/admin/categories',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(mockFetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:3333/admin/products',
    expect.objectContaining({
      body: JSON.stringify({
        categoryId: 'category-id',
        description: 'Copo 300 ml',
        name: 'Suco de laranja',
        priceCents: 900,
      }),
      method: 'POST',
    }),
  );
});

it('deactivates a product through the delete contract', async () => {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ product: category.products[0] }),
    ok: true,
  });

  await deleteMenuProduct('http://localhost:3333', 'product-id');

  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3333/admin/products/product-id',
    { method: 'DELETE' },
  );
});
