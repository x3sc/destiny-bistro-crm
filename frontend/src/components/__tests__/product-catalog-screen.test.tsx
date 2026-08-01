import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import type { Product } from '../../services/products-api';
import { themeColors } from '../../theme/tokens';
import { styles as catalogStyles } from '../product-catalog-screen.styles';
import { ProductCatalogScreen } from '../product-catalog-screen';

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: React.EffectCallback) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const comanda: Comanda = {
  cancellationReason: null,
  cancelledAt: null,
  closedAt: null,
  credit: null,
  events: [],
  id: 'comanda-id',
  items: [
    {
      confirmedQuantity: 0,
      createdAt: '2026-06-02T19:05:00.000Z',
      id: 'item-id',
      productId: 'coffee-id',
      productName: 'Café',
      quantity: 2,
      subtotalCents: 1200,
      unitPriceCents: 600,
    },
  ],
  name: null,
  number: 42,
  openedAt: '2026-06-02T19:00:00.000Z',
  status: 'OPEN',
  table: {
    id: 1,
    number: 1,
  },
  totalCents: 1200,
};

const products: Product[] = [
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

it('shows all products and filters them with category chips', async () => {
  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  expect(await screen.findByRole('button', { name: 'Todos' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Hambúrgueres clássicos' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bebidas' })).toBeTruthy();
  expect(await screen.findByText('Café')).toBeTruthy();
  expect(screen.getByText('Água')).toBeTruthy();
  expect(screen.getByText('R$ 6,00')).toBeTruthy();
  expect(screen.getByText('Já lançado: 2')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Diminuir Café' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Aumentar Café' })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Bebidas' }));

  expect(await screen.findByText('Água')).toBeTruthy();
  expect(screen.queryByText('Café')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Todos' }));

  expect(await screen.findByText('Café')).toBeTruthy();
  expect(screen.getByText('Água')).toBeTruthy();
});

it('uses the shared light theme on the product catalog', () => {
  expect(catalogStyles.safeArea).toEqual(
    expect.objectContaining({ backgroundColor: themeColors.background }),
  );
  expect(catalogStyles.productCard).toEqual(
    expect.objectContaining({ backgroundColor: themeColors.surface }),
  );
  expect(catalogStyles.button).toEqual(
    expect.objectContaining({ backgroundColor: themeColors.primary }),
  );
});

it('filters products by name', async () => {
  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  const searchInput = await screen.findByRole('search', {
    name: 'Buscar produto',
  });
  fireEvent.changeText(searchInput, 'agua');

  expect(await screen.findByText('Água')).toBeTruthy();
  expect(screen.queryByText('Café')).toBeNull();
});

it('stays in catalog after adding a product', async () => {
  const addItemRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      items: [
        ...comanda.items,
        {
          confirmedQuantity: 0,
          createdAt: '2026-06-02T19:05:00.000Z',
          id: 'water-item-id',
          productId: 'water-id',
          productName: 'Água',
          quantity: 1,
          subtotalCents: 500,
          unitPriceCents: 500,
        },
      ],
      totalCents: 1700,
    }),
  );

  render(
    <ProductCatalogScreen
      addItemRequest={addItemRequest}
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Bebidas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar Água' }));

  expect(addItemRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    'comanda-id',
    'water-id',
  );
  expect(await screen.findByText('Já lançado: 1')).toBeTruthy();
  expect(screen.getByText('Adicionar produtos')).toBeTruthy();
});

it('increments an existing temporary product from the catalog', async () => {
  const changeItemQuantityRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      items: [{ ...comanda.items[0], quantity: 3, subtotalCents: 1800 }],
      totalCents: 1800,
    }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      changeItemQuantityRequest={changeItemQuantityRequest}
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Aumentar Café' }));

  expect(changeItemQuantityRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    'comanda-id',
    'item-id',
    1,
  );
  expect(await screen.findByText('Já lançado: 3')).toBeTruthy();
});

it('decrements only the temporary quantity of a product', async () => {
  const changeItemQuantityRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      items: [{ ...comanda.items[0], quantity: 1, subtotalCents: 600 }],
      totalCents: 600,
    }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      changeItemQuantityRequest={changeItemQuantityRequest}
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Diminuir Café' }));

  expect(changeItemQuantityRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    'comanda-id',
    'item-id',
    -1,
  );
  expect(await screen.findByText('Já lançado: 1')).toBeTruthy();
});

it('removes the item when its last temporary unit reaches zero', async () => {
  const singleItemComanda: Comanda = {
    ...comanda,
    items: [{ ...comanda.items[0], quantity: 1, subtotalCents: 600 }],
    totalCents: 600,
  };
  const removeItemRequest = jest.fn(() =>
    Promise.resolve({ ...singleItemComanda, items: [], totalCents: 0 }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(singleItemComanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      removeItemRequest={removeItemRequest}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Diminuir Café' }));

  expect(removeItemRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    'comanda-id',
    'item-id',
  );
  expect(await screen.findByRole('button', { name: 'Adicionar Café' })).toBeTruthy();
});

it('does not decrement a confirmed product below its confirmed quantity', async () => {
  const confirmedComanda: Comanda = {
    ...comanda,
    items: [{ ...comanda.items[0], confirmedQuantity: 1, quantity: 2 }],
  };
  const changeItemQuantityRequest = jest.fn(() =>
    Promise.resolve({
      ...confirmedComanda,
      items: [{ ...confirmedComanda.items[0], quantity: 1, subtotalCents: 600 }],
      totalCents: 600,
    }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      changeItemQuantityRequest={changeItemQuantityRequest}
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(confirmedComanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Diminuir Café' }));

  expect(await screen.findByRole('button', { name: 'Adicionar Café' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Diminuir Café' })).toBeNull();
  expect(changeItemQuantityRequest).toHaveBeenCalledTimes(1);
});

it('shows an error when adding a product fails', async () => {
  render(
    <ProductCatalogScreen
      addItemRequest={() => Promise.reject(new Error('offline'))}
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Bebidas' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Adicionar Água' }),
  );

  expect(await screen.findByText('Não foi possível adicionar o produto.')).toBeTruthy();
});
