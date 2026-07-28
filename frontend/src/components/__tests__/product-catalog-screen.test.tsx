import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import type { Product } from '../../services/products-api';
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
  events: [],
  id: 'comanda-id',
  items: [
    {
      confirmedQuantity: 0,
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

it('navigates from the category table to products and back', async () => {
  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
    />,
  );

  expect(await screen.findByRole('button', { name: 'Hambúrgueres clássicos' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bebidas' })).toBeTruthy();
  expect(screen.queryByText('Café')).toBeNull();
  expect(screen.queryByText('Água')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Hambúrgueres clássicos' }));

  expect(await screen.findByText('Café')).toBeTruthy();
  expect(screen.getByText('R$ 6,00')).toBeTruthy();
  expect(screen.getByText('Já lançado: 2')).toBeTruthy();
  expect(screen.queryByText('Água')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Voltar às categorias' }));

  expect(screen.getByRole('button', { name: 'Bebidas' })).toBeTruthy();
  expect(screen.queryByText('Café')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Bebidas' }));

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
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar' }));

  expect(addItemRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    'comanda-id',
    'water-id',
  );
  expect(await screen.findByText('Já lançado: 1')).toBeTruthy();
  expect(screen.getByText('Adicionar produtos')).toBeTruthy();
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

  fireEvent.press(await screen.findByRole('button', { name: 'Hambúrgueres clássicos' }));
  const addButtons = await screen.findAllByRole('button', { name: 'Adicionar' });
  fireEvent.press(addButtons[0]);

  expect(await screen.findByText('Não foi possível adicionar o produto.')).toBeTruthy();
});
