export type IngredientUnit = "UNIT" | "GRAM" | "MILLILITER";
export type InventoryMovementType = "ENTRY" | "EXIT" | "ADJUSTMENT";

export interface InventoryItem {
  id: string;
  ingredient: {
    active: boolean;
    code: string;
    id: string;
    name: string;
    unit: IngredientUnit;
  };
  lowStock: boolean;
  minimumQuantity: number;
  quantity: number;
  updatedAt: string;
}

export interface InventoryMovement {
  balanceAfter: number;
  createdAt: string;
  id: string;
  quantityDelta: number;
  reason: string;
  stockId: string;
  type: InventoryMovementType;
}

export interface CreateIngredientInput {
  code: string;
  minimumQuantity: number;
  name: string;
  unit: IngredientUnit;
}

export interface CreateMovementInput {
  quantityDelta: number;
  reason: string;
  type: InventoryMovementType;
}

export interface InventoryRepository {
  createIngredient(
    establishmentId: string,
    input: CreateIngredientInput,
    actorUserId: string,
  ): Promise<InventoryItem>;
  createMovement(
    establishmentId: string,
    stockId: string,
    input: CreateMovementInput,
    actorUserId: string,
  ): Promise<InventoryMovement>;
  list(establishmentId: string): Promise<InventoryItem[]>;
}

export class IngredientConflictError extends Error {}
export class IngredientInputError extends Error {}
export class InventoryBalanceError extends Error {}
export class InventoryMovementConflictError extends Error {}
export class InventoryMovementInputError extends Error {}
export class InventoryStockNotFoundError extends Error {}
