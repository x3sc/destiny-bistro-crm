export type PaymentMethod = "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD";
export type PaymentOrigin =
  | "TABLE_CHECKOUT"
  | "CREDIT_INSTALLMENT"
  | "DELIVERY_CHECKOUT";

export interface PaymentAllocationInput {
  amountCents: number;
  method: PaymentMethod;
}

export interface PaymentAllocation extends PaymentAllocationInput {
  id: string;
}

export interface Payment {
  allocations: PaymentAllocation[];
  amountCents: number;
  comandaId: string;
  creditOrderId: string | null;
  id: string;
  origin: PaymentOrigin;
  paidAt: string;
  recordedBy: {
    id: string;
    name: string;
  } | null;
}

export class PaymentInputError extends Error {}

const paymentMethods = new Set<PaymentMethod>([
  "CASH",
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
]);

export function normalizePaymentAllocations(value: unknown): PaymentAllocationInput[] {
  if (!Array.isArray(value)) {
    throw new PaymentInputError();
  }

  const totals = new Map<PaymentMethod, number>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") {
      throw new PaymentInputError();
    }

    const { amountCents, method } = candidate as {
      amountCents?: unknown;
      method?: unknown;
    };
    if (
      typeof method !== "string" ||
      !paymentMethods.has(method as PaymentMethod) ||
      !Number.isSafeInteger(amountCents) ||
      Number(amountCents) <= 0
    ) {
      throw new PaymentInputError();
    }

    const paymentMethod = method as PaymentMethod;
    const total = (totals.get(paymentMethod) ?? 0) + Number(amountCents);
    if (!Number.isSafeInteger(total)) {
      throw new PaymentInputError();
    }
    totals.set(paymentMethod, total);
  }

  return (["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"] as const).flatMap(
    (method) => {
      const amountCents = totals.get(method);
      return amountCents ? [{ amountCents, method }] : [];
    },
  );
}

export function paymentTotal(allocations: PaymentAllocationInput[]) {
  return allocations.reduce((total, allocation) => total + allocation.amountCents, 0);
}
