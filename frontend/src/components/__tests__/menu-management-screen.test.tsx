import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { MenuManagementScreen } from '../menu-management-screen';

const category = {
  active: true,
  id: 'category-id',
  name: 'Bebidas',
  products: [
    {
      active: true,
      description: null,
      id: 'product-id',
      name: 'Agua',
      priceCents: 500,
    },
  ],
};

const secondCategory = {
  active: true,
  id: 'second-category-id',
  name: 'Sobremesas',
  products: [
    {
      active: true,
      description: null,
      id: 'second-product-id',
      name: 'Brigadeiro',
      priceCents: 700,
    },
  ],
};

it('starts collapsed and keeps only one category expanded', async () => {
  render(
    <MenuManagementScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={jest.fn().mockResolvedValue([category, secondCategory])}
      onBack={jest.fn()}
    />,
  );

  await waitFor(() => expect(screen.getByText('Bebidas')).toBeTruthy());
  expect(screen.queryByText('Agua')).toBeNull();
  expect(screen.queryByText('Brigadeiro')).toBeNull();

  fireEvent.press(
    screen.getByRole('button', { name: 'Expandir categoria Bebidas' }),
  );
  expect(screen.getByText('Agua')).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', { name: 'Expandir categoria Sobremesas' }),
  );
  expect(screen.queryByText('Agua')).toBeNull();
  expect(screen.getByText('Brigadeiro')).toBeTruthy();
});

it('opens menu editors in modals and exposes recipe only while editing an item', async () => {
  const loadRecipeIngredientsRequest = jest.fn().mockResolvedValue([
    { id: 'ingredient-id', name: 'Farinha', unit: 'GRAM' },
    { id: 'second-ingredient-id', name: 'Leite', unit: 'MILLILITER' },
  ]);
  const replaceRecipeRequest = jest.fn().mockResolvedValue({
    ...category.products[0],
    recipe: [
      {
        ingredient: { id: 'ingredient-id', name: 'Farinha', unit: 'GRAM' },
        quantity: 150,
      },
    ],
  });
  render(
    <MenuManagementScreen
      apiBaseUrl="http://localhost:3333"
      loadRecipeIngredientsRequest={loadRecipeIngredientsRequest}
      loadRequest={jest.fn().mockResolvedValue([category])}
      onBack={jest.fn()}
      replaceRecipeRequest={replaceRecipeRequest}
    />,
  );

  await screen.findByText('Bebidas');
  expect(screen.queryByRole('button', { name: 'Receitas e adicionais' })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));
  expect(screen.getByLabelText('Janela de nova categoria')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

  fireEvent.press(screen.getByRole('button', { name: 'Expandir categoria Bebidas' }));
  fireEvent.press(screen.getByRole('button', { name: 'Editar categoria Bebidas' }));
  expect(screen.getByLabelText('Janela de editar categoria')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

  fireEvent.press(screen.getByRole('button', { name: 'Novo item em Bebidas' }));
  expect(screen.getByLabelText('Janela de novo item')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Receita' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

  fireEvent.press(screen.getByRole('button', { name: 'Editar item Agua' }));
  expect(screen.getByLabelText('Janela de editar item')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Receita' }));

  expect(await screen.findByLabelText('Janela de receita de Agua')).toBeTruthy();
  expect(loadRecipeIngredientsRequest).toHaveBeenCalledWith('http://localhost:3333');
  expect(screen.queryByLabelText('Quantidade de Farinha')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar insumo' }));
  expect(screen.getByLabelText('Janela para adicionar insumo')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Buscar insumo por nome'), 'fari');
  expect(screen.getByRole('button', { name: 'Adicionar insumo Farinha' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Adicionar insumo Leite' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar insumo Farinha' }));
  expect(screen.queryByLabelText('Janela para adicionar insumo')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Quantidade de Farinha'), '150');
  fireEvent.press(screen.getByRole('button', { name: 'Salvar receita' }));

  await waitFor(() => expect(replaceRecipeRequest).toHaveBeenCalledWith(
    'http://localhost:3333',
    'product-id',
    [{ ingredientId: 'ingredient-id', quantity: 150 }],
  ));
  expect(screen.queryByLabelText('Janela de receita de Agua')).toBeNull();
  expect(screen.getByLabelText('Janela de editar item')).toBeTruthy();
  expect(screen.getByText('Receita salva.')).toBeTruthy();
});

it('creates a category, expands it and adds a priced item inside its card', async () => {
  const emptyCategory = { ...category, products: [] };
  const createCategoryRequest = jest.fn().mockResolvedValue(emptyCategory);
  const createProductRequest = jest.fn().mockResolvedValue(category.products[0]);
  const loadRequest = jest
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([emptyCategory])
    .mockResolvedValueOnce([category]);

  render(
    <MenuManagementScreen
      apiBaseUrl="http://localhost:3333"
      createCategoryRequest={createCategoryRequest}
      createProductRequest={createProductRequest}
      loadRequest={loadRequest}
      onBack={jest.fn()}
    />,
  );

  await waitFor(() =>
    expect(screen.getByText('Nenhuma categoria cadastrada.')).toBeTruthy(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Nova categoria' }));
  fireEvent.changeText(screen.getByLabelText('Nome da categoria'), 'Bebidas');
  fireEvent.press(
    screen.getByRole('button', { name: 'Salvar categoria' }),
  );

  await waitFor(() =>
    expect(createCategoryRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      { name: 'Bebidas' },
    ),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Recolher categoria Bebidas' }),
    ).toBeTruthy(),
  );

  fireEvent.press(
    screen.getByRole('button', { name: 'Novo item em Bebidas' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Nome do item'),
    'Suco',
  );
  expect(
    screen.getByDisplayValue('R$ 0,00'),
  ).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Preço do item'),
    '1',
  );
  expect(screen.getByDisplayValue('R$ 0,01')).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Preço do item'),
    'R$ 0,012',
  );
  expect(screen.getByDisplayValue('R$ 0,12')).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Preço do item'),
    'R$ 0,123',
  );
  expect(screen.getByDisplayValue('R$ 1,23')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Salvar item' }),
  );

  await waitFor(() =>
    expect(createProductRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      {
        categoryId: 'category-id',
        description: null,
        name: 'Suco',
        priceCents: 123,
      },
    ),
  );
  expect(
    screen.getByRole('button', { name: 'Recolher categoria Bebidas' }),
  ).toBeTruthy();
});

it('discards the product modal when creation is cancelled', async () => {
  render(
    <MenuManagementScreen
      apiBaseUrl="http://localhost:3333"
      loadRequest={jest.fn().mockResolvedValue([category])}
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', { name: 'Expandir categoria Bebidas' }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Novo item em Bebidas' }),
  );
  fireEvent.changeText(screen.getByLabelText('Nome do item'), 'Rascunho');

  fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

  expect(screen.queryByLabelText('Nome do item')).toBeNull();
  expect(screen.queryByDisplayValue('Rascunho')).toBeNull();
});

it('edits products inside the category and keeps lifecycle actions working', async () => {
  const deleteCategoryRequest = jest.fn().mockResolvedValue(category);
  const deleteProductRequest = jest.fn().mockResolvedValue(category.products[0]);
  const updateCategoryRequest = jest.fn().mockResolvedValue(category);
  const updateProductRequest = jest.fn().mockResolvedValue(category.products[0]);

  render(
    <MenuManagementScreen
      apiBaseUrl="http://localhost:3333"
      deleteCategoryRequest={deleteCategoryRequest}
      deleteProductRequest={deleteProductRequest}
      loadRequest={jest.fn().mockResolvedValue([category])}
      onBack={jest.fn()}
      updateCategoryRequest={updateCategoryRequest}
      updateProductRequest={updateProductRequest}
    />,
  );

  fireEvent.press(
    await screen.findByRole('button', { name: 'Expandir categoria Bebidas' }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Editar categoria Bebidas' }),
  );
  fireEvent.changeText(
    screen.getByLabelText('Nome da categoria'),
    'Bebidas geladas',
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Salvar categoria' }),
  );
  await waitFor(() => expect(updateCategoryRequest).toHaveBeenCalled());

  fireEvent.press(screen.getByRole('button', { name: 'Editar item Agua' }));
  fireEvent.changeText(
    screen.getByLabelText('Preço do item'),
    '650',
  );
  expect(screen.getByDisplayValue('R$ 6,50')).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Salvar item' }),
  );
  await waitFor(() => expect(updateProductRequest).toHaveBeenCalled());

  fireEvent(screen.getByLabelText('Desativar item Agua'), 'valueChange', false);
  await waitFor(() => expect(deleteProductRequest).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByText('Item desativado.')).toBeTruthy(),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Desativar categoria Bebidas' }),
  );
  await waitFor(() => expect(deleteCategoryRequest).toHaveBeenCalled());
});
