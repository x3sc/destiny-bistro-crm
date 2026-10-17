import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { Comanda } from '../../services/comandas-api';
import type { Product } from '../../services/products-api';
import { themeColors, themeSpacing } from '../../theme/tokens';
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
  payments: [],
  status: 'OPEN',
  table: {
    id: 1,
    number: 1,
  },
  totalCents: 1200,
};

const products: Product[] = [
  {
    category: { id: 'food-id', name: 'Lanches' },
    description: null,
    id: 'coffee-id',
    name: 'Café',
    priceCents: 600,
    requiresKitchen: true,
  },
  {
    category: { id: 'drinks-id', name: 'Bebidas' },
    description: null,
    id: 'water-id',
    name: 'Água',
    priceCents: 500,
    requiresKitchen: false,
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
  expect(screen.getByRole('button', { name: 'Lanches' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bebidas' })).toBeTruthy();
  expect(await screen.findByText('Café')).toBeTruthy();
  expect(screen.getByText('Água')).toBeTruthy();
  expect(screen.getByText('R$ 6,00')).toBeTruthy();
  expect(screen.getByText('Já lançado: 2')).toBeTruthy();
  expect(screen.getByText('2 unidades temporárias')).toBeTruthy();
  expect(screen.getByText('2 itens pendentes')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Adicionar 2 itens' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Diminuir Café' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Aumentar Café' })).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Bebidas' }));

  expect(await screen.findByText('Água')).toBeTruthy();
  expect(screen.queryByText('Café')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Todos' }));

  expect(await screen.findByText('Café')).toBeTruthy();
  expect(screen.getByText('Água')).toBeTruthy();
});

it('returns to details keeping every temporary item pending', async () => {
  const onAdded = jest.fn();
  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      onAdded={onAdded}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', { name: 'Adicionar 2 itens' }),
  );

  await waitFor(() => {
    expect(onAdded).toHaveBeenCalledWith(comanda);
  });
});

it('cancels all temporary items before returning to details', async () => {
  const comandaWithoutPending = { ...comanda, items: [] };
  const discardPendingItemsRequest = jest.fn(() =>
    Promise.resolve(comandaWithoutPending),
  );
  const onAdded = jest.fn();
  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      discardPendingItemsRequest={discardPendingItemsRequest}
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      onAdded={onAdded}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));

  await waitFor(() => {
    expect(discardPendingItemsRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
    );
    expect(onAdded).toHaveBeenCalledWith(comandaWithoutPending);
  });
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
  expect(catalogStyles.content).toEqual(
    expect.objectContaining({ paddingHorizontal: themeSpacing.mobileMargin }),
  );
  expect(catalogStyles.pendingBar).toEqual(
    expect.objectContaining({ paddingHorizontal: themeSpacing.mobileMargin }),
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

  expect(addItemRequest).not.toHaveBeenCalled();
  expect(await screen.findByText('Já lançado: 1')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 3 itens' }));

  await waitFor(() => {
  expect(addItemRequest).toHaveBeenCalledWith(
    'http://192.168.0.10:3333',
    'comanda-id',
    'water-id',
  );
  });
  expect(screen.getByText('Adicionar produtos')).toBeTruthy();
  expect(screen.getByTestId('branded-screen-header')).toBeTruthy();
});

it('saves rapid quantity changes only after adding the pending items', async () => {
  const setItemPendingQuantityRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      items: [{ ...comanda.items[0], quantity: 5, subtotalCents: 3000 }],
      totalCents: 3000,
    }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      setItemPendingQuantityRequest={setItemPendingQuantityRequest}
    />,
  );

  await screen.findByRole('button', { name: 'Aumentar Café' });
  fireEvent.press(screen.getByRole('button', { name: 'Aumentar Café' }));
  fireEvent.press(screen.getByRole('button', { name: 'Aumentar Café' }));
  fireEvent.press(screen.getByRole('button', { name: 'Aumentar Café' }));

  expect(screen.getByText('5 unidades temporárias')).toBeTruthy();
  expect(setItemPendingQuantityRequest).not.toHaveBeenCalled();

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  expect(setItemPendingQuantityRequest).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 5 itens' }));

  await waitFor(() => {
    expect(setItemPendingQuantityRequest).toHaveBeenCalledTimes(1);
    expect(setItemPendingQuantityRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
      5,
    );
  });
});

it('sets an integer temporary quantity directly from the catalog', async () => {
  const setItemPendingQuantityRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      items: [{ ...comanda.items[0], quantity: 20, subtotalCents: 12_000 }],
      totalCents: 12_000,
    }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      setItemPendingQuantityRequest={setItemPendingQuantityRequest}
    />,
  );

  const quantityInput = await screen.findByLabelText(
    'Quantidade temporária de Café',
  );
  fireEvent.changeText(quantityInput, '20');
  fireEvent(quantityInput, 'submitEditing');

  expect(setItemPendingQuantityRequest).not.toHaveBeenCalled();
  expect(await screen.findByText('Já lançado: 20')).toBeTruthy();
  expect(screen.getByText('20 unidades temporárias')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 20 itens' }));
  await waitFor(() => {
    expect(setItemPendingQuantityRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
      20,
    );
  });
});

it('rejects direct quantities outside the integer range from 1 to 99', async () => {
  const setItemPendingQuantityRequest = jest.fn();

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      setItemPendingQuantityRequest={setItemPendingQuantityRequest}
    />,
  );

  const quantityInput = await screen.findByLabelText(
    'Quantidade temporária de Café',
  );
  fireEvent.changeText(quantityInput, '100');
  fireEvent(quantityInput, 'submitEditing');

  expect(setItemPendingQuantityRequest).not.toHaveBeenCalled();
  expect(quantityInput).toHaveProp('value', '2');

  fireEvent.changeText(quantityInput, '2x');
  expect(quantityInput).toHaveProp('value', '2');
});

it('decrements only the temporary quantity of a product', async () => {
  const setItemPendingQuantityRequest = jest.fn(() =>
    Promise.resolve({
      ...comanda,
      items: [{ ...comanda.items[0], quantity: 1, subtotalCents: 600 }],
      totalCents: 600,
    }),
  );

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(comanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      setItemPendingQuantityRequest={setItemPendingQuantityRequest}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Diminuir Café' }));

  expect(setItemPendingQuantityRequest).not.toHaveBeenCalled();
  expect(await screen.findByText('Já lançado: 1')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 1 item' }));
  await waitFor(() => {
    expect(setItemPendingQuantityRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
      1,
    );
  });
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

  expect(removeItemRequest).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 0 itens' }));
  await waitFor(() => {
    expect(removeItemRequest).toHaveBeenCalledWith(
      'http://192.168.0.10:3333',
      'comanda-id',
      'item-id',
    );
  });
  expect(await screen.findByRole('button', { name: 'Adicionar Café' })).toBeTruthy();
});

it('consolidates rapid decrements to zero into one removal request', async () => {
  const threeItemComanda: Comanda = {
    ...comanda,
    items: [{ ...comanda.items[0], quantity: 3, subtotalCents: 1800 }],
    totalCents: 1800,
  };
  const removeItemRequest = jest.fn(() =>
    Promise.resolve({ ...threeItemComanda, items: [], totalCents: 0 }),
  );
  const setItemPendingQuantityRequest = jest.fn();

  render(
    <ProductCatalogScreen
      apiBaseUrl="http://192.168.0.10:3333"
      comandaId="comanda-id"
      loadComandaRequest={() => Promise.resolve(threeItemComanda)}
      loadProductsRequest={() => Promise.resolve(products)}
      onBack={jest.fn()}
      removeItemRequest={removeItemRequest}
      setItemPendingQuantityRequest={setItemPendingQuantityRequest}
    />,
  );

  await screen.findByRole('button', { name: 'Diminuir Café' });
  fireEvent.press(screen.getByRole('button', { name: 'Diminuir Café' }));
  fireEvent.press(screen.getByRole('button', { name: 'Diminuir Café' }));
  fireEvent.press(screen.getByRole('button', { name: 'Diminuir Café' }));

  expect(await screen.findByRole('button', { name: 'Adicionar Café' })).toBeTruthy();
  expect(removeItemRequest).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 0 itens' }));
  await waitFor(() => {
    expect(removeItemRequest).toHaveBeenCalledTimes(1);
  });
  expect(setItemPendingQuantityRequest).not.toHaveBeenCalled();
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
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 0 itens' }));
  await waitFor(() => {
    expect(changeItemQuantityRequest).toHaveBeenCalledTimes(1);
  });
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
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar 3 itens' }));

  expect(
    await screen.findByText(
      'Não foi possível concluir as alterações. Recarregue a comanda e tente novamente.',
    ),
  ).toBeTruthy();
});
