export type ComandaPrintKind = "CONFIRMED" | "KITCHEN_PENDING" | 'CHECKOUT_PREVIEW' | 'COUNTER_PENDING' | 'COUNTER_FINAL';

export interface ComandaPrintSource {
  creditOrder?: unknown;
  serviceFeeApplied?: boolean | null;
  serviceFeePercent?: number;
  serviceFeeSubtotalCents?: number | null;
  serviceFeeAmountCents?: number;
  deliveryFeeCents: number | null;
  establishmentName: string;
  id: string;
  items: {
    configurations: {
      additionals: {
        additionalName: string;
        quantityPerUnit: number;
        unitPriceCents: number;
      }[];
      confirmedQuantity: number;
      quantity: number;
    }[];
    productName: string;
    requiresKitchen: boolean;
    unitPriceCents: number;
  }[];
  name: string | null;
  number: number;
  openedAt: Date;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  tableName?: string | null;
  tableNumber: number | null;
}

export interface ComandaPrintDocument {
  serviceFee?: { included: boolean; percent: number; subtotalCents: number; amountCents: number };
  externalPaymentMethod?: 'COUNTER';
  comandaId: string;
  comandaName: string | null;
  comandaNumber: number;
  deliveryFeeCents: number | null;
  destination: "QUICK_SALE" | "COUNTER" | "DELIVERY" | "TABLE";
  establishmentName: string;
  generatedAt: string;
  generatedBy: string;
  items: ComandaPrintItem[];
  kind: ComandaPrintKind;
  openedAt: string;
  status: ComandaPrintSource["status"];
  tableName?: string | null;
  tableNumber: number | null;
  totalCents: number | null;
}

export interface ComandaPrintItem {
  additionals: {
    name: string;
    quantityPerUnit: number;
    unitPriceCents: number | null;
  }[];
  productName: string;
  quantity: number;
  subtotalCents: number | null;
  unitPriceCents: number | null;
}

export class PrintDocumentEmptyError extends Error {}
export class CounterPrintConflictError extends Error {}

export function buildComandaPrintDocument(
  source: ComandaPrintSource,
  kind: ComandaPrintKind,
  generatedBy: string,
  generatedAt = new Date(),
): ComandaPrintDocument {
  const counterPending = kind === 'COUNTER_PENDING';
  const counterFinal = kind === 'COUNTER_FINAL';
  if (counterPending || counterFinal) {
    if (source.tableName !== 'Balcão' || source.tableNumber !== null || source.deliveryFeeCents !== null ||
      source.creditOrder || source.status !== 'OPEN') throw new PrintDocumentEmptyError();
    if (counterFinal && source.items.some((item) => item.configurations.some(
      (configuration) => configuration.quantity > configuration.confirmedQuantity,
    ))) throw new CounterPrintConflictError();
  }
  const includeServiceFee = kind !== 'KITCHEN_PENDING' && !counterPending;
  const items = source.items.flatMap((item) => {
    if (kind === "KITCHEN_PENDING" && !item.requiresKitchen) {
      return [];
    }

    return item.configurations.flatMap((configuration) => {
      const quantity =
        kind !== "KITCHEN_PENDING" && !counterPending
          ? configuration.confirmedQuantity
          : configuration.quantity - configuration.confirmedQuantity;
      if (quantity <= 0) {
        return [];
      }

      const additionalUnitCents = configuration.additionals.reduce(
        (total, additional) =>
          total + additional.unitPriceCents * additional.quantityPerUnit,
        0,
      );
      const unitPriceCents = item.unitPriceCents + additionalUnitCents;

      return [
        {
          additionals: configuration.additionals.map((additional) => ({
            name: additional.additionalName,
            quantityPerUnit: additional.quantityPerUnit,
            unitPriceCents:
              kind !== "KITCHEN_PENDING" ? additional.unitPriceCents : null,
          })),
          productName: item.productName,
          quantity,
          subtotalCents:
            kind !== "KITCHEN_PENDING" ? quantity * unitPriceCents : null,
          unitPriceCents: kind !== "KITCHEN_PENDING" ? unitPriceCents : null,
        },
      ];
    });
  });

  if (items.length === 0) {
    throw new PrintDocumentEmptyError();
  }

  const deliveryFeeCents =
    includeServiceFee ? source.deliveryFeeCents : null;
  const itemTotalCents = items.reduce(
    (total, item) => total + (item.subtotalCents ?? 0),
    0,
  );

  return {
    ...(includeServiceFee && typeof source.serviceFeeApplied === 'boolean' ? { serviceFee: {
      included: source.serviceFeeApplied, percent: source.serviceFeePercent ?? 0, subtotalCents: source.serviceFeeSubtotalCents ?? itemTotalCents,
      amountCents: source.serviceFeeAmountCents ?? 0 } } : {}),
    comandaId: source.id,
    ...(source.tableName === 'Balcão' && source.status === 'CLOSED' && kind === 'CONFIRMED' ? { externalPaymentMethod: 'COUNTER' as const } : {}),
    comandaName: source.name,
    comandaNumber: source.number,
    deliveryFeeCents,
    destination:
      source.tableNumber !== null
        ? "TABLE"
        : source.deliveryFeeCents !== null
          ? "DELIVERY"
          : source.tableName === "Venda rápida" ? "QUICK_SALE" : "COUNTER",
    establishmentName: source.establishmentName,
    generatedAt: generatedAt.toISOString(),
    generatedBy,
    items,
    kind,
    openedAt: source.openedAt.toISOString(),
    status: source.status,
    tableNumber: source.tableNumber,
    totalCents:
      kind !== "KITCHEN_PENDING"
        ? itemTotalCents + (deliveryFeeCents ?? 0) + (includeServiceFee ? source.serviceFeeAmountCents ?? 0 : 0)
        : null,
  };
}
