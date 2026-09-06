export type ComandaPrintKind = "CONFIRMED" | "KITCHEN_PENDING";

export interface ComandaPrintSource {
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
  tableNumber: number | null;
}

export interface ComandaPrintDocument {
  comandaId: string;
  comandaName: string | null;
  comandaNumber: number;
  deliveryFeeCents: number | null;
  destination: "COUNTER" | "DELIVERY" | "TABLE";
  establishmentName: string;
  generatedAt: string;
  generatedBy: string;
  items: ComandaPrintItem[];
  kind: ComandaPrintKind;
  openedAt: string;
  status: ComandaPrintSource["status"];
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

export function buildComandaPrintDocument(
  source: ComandaPrintSource,
  kind: ComandaPrintKind,
  generatedBy: string,
  generatedAt = new Date(),
): ComandaPrintDocument {
  const items = source.items.flatMap((item) => {
    if (kind === "KITCHEN_PENDING" && !item.requiresKitchen) {
      return [];
    }

    return item.configurations.flatMap((configuration) => {
      const quantity =
        kind === "CONFIRMED"
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
              kind === "CONFIRMED" ? additional.unitPriceCents : null,
          })),
          productName: item.productName,
          quantity,
          subtotalCents:
            kind === "CONFIRMED" ? quantity * unitPriceCents : null,
          unitPriceCents: kind === "CONFIRMED" ? unitPriceCents : null,
        },
      ];
    });
  });

  if (items.length === 0) {
    throw new PrintDocumentEmptyError();
  }

  const deliveryFeeCents =
    kind === "CONFIRMED" ? source.deliveryFeeCents : null;
  const itemTotalCents = items.reduce(
    (total, item) => total + (item.subtotalCents ?? 0),
    0,
  );

  return {
    comandaId: source.id,
    comandaName: source.name,
    comandaNumber: source.number,
    deliveryFeeCents,
    destination:
      source.tableNumber !== null
        ? "TABLE"
        : source.deliveryFeeCents !== null
          ? "DELIVERY"
          : "COUNTER",
    establishmentName: source.establishmentName,
    generatedAt: generatedAt.toISOString(),
    generatedBy,
    items,
    kind,
    openedAt: source.openedAt.toISOString(),
    status: source.status,
    tableNumber: source.tableNumber,
    totalCents:
      kind === "CONFIRMED"
        ? itemTotalCents + (deliveryFeeCents ?? 0)
        : null,
  };
}
