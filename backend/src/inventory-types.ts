export type IngredientUnit = "UNIT" | "GRAM" | "MILLILITER";
export type InventoryInputUnit = IngredientUnit | "KILOGRAM" | "LITER";
export type InventoryMovementType =
  | "ENTRY"
  | "EXIT"
  | "ADJUSTMENT"
  | "SALE_CONSUMPTION"
  | "ADDITIONAL_CONSUMPTION"
  | "LOSS"
  | "MANUAL_EXIT"
  | "POSITIVE_ADJUSTMENT"
  | "NEGATIVE_ADJUSTMENT"
  | "REVERSAL";

export interface InventoryItem {
  deficitQuantity: number;
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
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  id: string;
  quantityDelta: number;
  reason: string;
  stockId: string;
  type: InventoryMovementType;
}

export interface InventoryLot {
  code: string | null;
  createdAt: string;
  currentQuantity: number;
  expiresAt: string | null;
  expired: boolean;
  id: string;
  initialQuantity: number;
  origin: "PURCHASE" | "ADJUSTMENT" | "REVERSAL" | "LEGACY";
  receivedAt: string;
  stockId: string;
  totalCostCents: number | null;
}

export interface CreateIngredientInput {
  code: string;
  minimumQuantity: number;
  name: string;
  unit: IngredientUnit;
}

export interface UpdateIngredientInput extends CreateIngredientInput {
  active: boolean;
}

export interface CreateEntryInput {
  code: string | null;
  expiresAt: string | null;
  quantity: string;
  reason: string;
  receivedAt: string;
  requestId: string;
  totalCostCents: number;
  unit: InventoryInputUnit;
}

export interface InventoryEntryResult {
  inventoryItem: InventoryItem;
  lot: InventoryLot;
  movement: InventoryMovement;
  replayed: boolean;
}

export interface CreateMovementInput {
  quantityDelta: number;
  reason: string;
  requestId: string;
  type: "EXIT" | "LOSS" | "ADJUSTMENT";
}

export interface InventoryMovementResult {
  movement: InventoryMovement;
  replayed: boolean;
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
  ): Promise<InventoryMovementResult>;
  createEntry(
    establishmentId: string,
    stockId: string,
    input: CreateEntryInput,
    actorUserId: string,
  ): Promise<InventoryEntryResult>;
  deactivateIngredient(
    establishmentId: string,
    ingredientId: string,
    actorUserId: string,
  ): Promise<InventoryItem>;
  list(establishmentId: string): Promise<InventoryItem[]>;
  listLots(establishmentId: string, stockId: string): Promise<InventoryLot[]>;
  listMovements(
    establishmentId: string,
    stockId: string,
  ): Promise<InventoryMovement[]>;
  updateIngredient(
    establishmentId: string,
    ingredientId: string,
    input: UpdateIngredientInput,
    actorUserId: string,
  ): Promise<InventoryItem>;
}

export class IngredientConflictError extends Error {}
export class IngredientInputError extends Error {}
export class InventoryBalanceError extends Error {}
export class InventoryMovementConflictError extends Error {}
export class InventoryMovementInputError extends Error {}
export class InventoryStockNotFoundError extends Error {}
export class InventoryRequestConflictError extends Error {}
