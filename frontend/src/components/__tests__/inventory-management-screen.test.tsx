import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  createIngredient,
  createInventoryEntry,
  loadInventory,
  loadInventoryLots,
  loadInventoryMovements,
  type InventoryItem,
} from '../../services/inventory-api';
import { themeColors } from '../../theme/tokens';
import { InventoryManagementScreen } from '../inventory-management-screen';

jest.mock('../../services/inventory-api', () => ({
  ...jest.requireActual('../../services/inventory-api'),
  createIngredient: jest.fn(),
  createInventoryEntry: jest.fn(),
  loadInventory: jest.fn(),
  loadInventoryLots: jest.fn(),
  loadInventoryMovements: jest.fn(),
}));

const createIngredientRequest = jest.mocked(createIngredient);
const createInventoryEntryRequest = jest.mocked(createInventoryEntry);
const loadInventoryRequest = jest.mocked(loadInventory);
const loadInventoryLotsRequest = jest.mocked(loadInventoryLots);
const loadInventoryMovementsRequest = jest.mocked(loadInventoryMovements);

const water: InventoryItem = {
  deficitQuantity: 0,
  id: 'stock-water',
  ingredient: {
    active: true,
    code: '54564564',
    id: 'ingredient-water',
    name: 'Garrafa de Agua',
    unit: 'UNIT',
  },
  lowStock: true,
  minimumQuantity: 10,
  quantity: 0,
  updatedAt: '2026-08-17T18:33:57.584Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  loadInventoryRequest.mockResolvedValue([]);
  loadInventoryLotsRequest.mockResolvedValue([]);
  loadInventoryMovementsRequest.mockResolvedValue([]);
});

it('opens the new ingredient form in a bordered modal', async () => {
  render(
    <InventoryManagementScreen
      apiBaseUrl="http://api.test"
      onBack={jest.fn()}
    />,
  );

  await waitFor(() => expect(loadInventoryRequest).toHaveBeenCalledWith('http://api.test'));

  const newIngredientButton = screen.getByRole('button', { name: 'Novo insumo' });
  expect(newIngredientButton).toHaveStyle({ borderWidth: 1 });
  expect(screen.queryByLabelText('Janela de novo insumo')).toBeNull();

  fireEvent.press(newIngredientButton);

  expect(screen.getByLabelText('Janela de novo insumo')).toBeTruthy();
  expect(screen.getByLabelText('Nome do insumo')).toBeTruthy();

  const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
  expect(cancelButton).toHaveStyle({ borderWidth: 1 });
  fireEvent.press(cancelButton);

  expect(screen.queryByLabelText('Janela de novo insumo')).toBeNull();
});

it('shows inventory feedback with contrast over the primary background', async () => {
  createIngredientRequest.mockResolvedValue({} as never);
  render(
    <InventoryManagementScreen
      apiBaseUrl="http://api.test"
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', { name: 'Novo insumo' }));
  fireEvent.changeText(screen.getByLabelText('Nome do insumo'), 'Farinha');
  fireEvent.changeText(screen.getByLabelText('Código do insumo'), 'FARINHA');
  fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('Insumo cadastrado.')).toHaveStyle({
    color: themeColors.foregroundOnPrimary,
  });
});

it('keeps ingredient field labels visible while editing prefilled values', async () => {
  loadInventoryRequest.mockResolvedValue([water]);
  render(
    <InventoryManagementScreen
      apiBaseUrl="http://api.test"
      onBack={jest.fn()}
    />,
  );

  fireEvent.press(await screen.findByRole('button', {
    name: 'Gerenciar Garrafa de Agua',
  }));
  await waitFor(() => {
    expect(loadInventoryLotsRequest).toHaveBeenCalledWith('http://api.test', water.id);
    expect(loadInventoryMovementsRequest).toHaveBeenCalledWith('http://api.test', water.id);
  });
  fireEvent.press(screen.getByRole('button', { name: 'Editar insumo' }));

  expect(screen.getByLabelText('Janela de editar insumo')).toBeTruthy();
  expect(screen.getByText('Nome')).toBeTruthy();
  expect(screen.getByText('Código')).toBeTruthy();
  expect(screen.getByText('Estoque mínimo')).toBeTruthy();
  expect(screen.getByLabelText('Nome do insumo').props.value).toBe('Garrafa de Agua');
  expect(screen.getByLabelText('Código do insumo').props.value).toBe('54564564');
  expect(screen.getByLabelText('Estoque mínimo').props.value).toBe('10');
  expect(screen.getByLabelText('Nome do insumo').props.placeholder).toBeUndefined();
});

it('opens the selected ingredient in a modal ready for an entry', async () => {
  loadInventoryRequest.mockResolvedValue([water]);
  createInventoryEntryRequest.mockResolvedValue(undefined);
  render(
    <InventoryManagementScreen
      apiBaseUrl="http://api.test"
      onBack={jest.fn()}
    />,
  );

  const ingredientButton = await screen.findByRole('button', {
    name: 'Gerenciar Garrafa de Agua',
  });
  expect(screen.queryByLabelText('Janela de estoque de Garrafa de Agua')).toBeNull();

  fireEvent.press(ingredientButton);

  expect(await screen.findByLabelText('Janela de estoque de Garrafa de Agua')).toBeTruthy();
  expect(screen.getByText('Registrar entrada')).toBeTruthy();
  expect(screen.getByText('Custo total (R$)')).toBeTruthy();
  expect(screen.getByLabelText('Quantidade')).toBeTruthy();
  expect(screen.getByLabelText('Custo total em reais').props.value).toBe('R$ 0,00');
  expect(screen.getByLabelText('Custo total em reais').props.placeholder).toBeUndefined();
  expect(loadInventoryLotsRequest).toHaveBeenCalledWith('http://api.test', water.id);
  expect(loadInventoryMovementsRequest).toHaveBeenCalledWith('http://api.test', water.id);

  fireEvent.changeText(screen.getByLabelText('Quantidade'), '3');
  fireEvent.changeText(screen.getByLabelText('Motivo'), 'Compra');
  fireEvent.changeText(screen.getByLabelText('Validade do lote'), '31022027');
  expect(screen.getByText('Informe uma data válida no formato DD/MM/AAAA.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Confirmar' }).props.accessibilityState)
    .toMatchObject({ disabled: true });

  fireEvent.changeText(screen.getByLabelText('Validade do lote'), '31122027');
  fireEvent.changeText(screen.getByLabelText('Custo total em reais'), '12345');

  expect(screen.getByLabelText('Validade do lote').props.value).toBe('31/12/2027');
  expect(screen.queryByText('Informe uma data válida no formato DD/MM/AAAA.')).toBeNull();
  expect(screen.getByLabelText('Custo total em reais').props.value).toBe('R$ 123,45');
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));

  await waitFor(() => expect(createInventoryEntryRequest).toHaveBeenCalledWith(
    'http://api.test',
    water.id,
    expect.objectContaining({
      expiresAt: '2027-12-31T12:00:00.000Z',
      quantity: '3',
      reason: 'Compra',
      totalCostCents: 12345,
    }),
  ));
});
