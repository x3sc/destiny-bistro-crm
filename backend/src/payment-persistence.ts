import type { Prisma } from "./generated/prisma/client.js";
import type {
  Payment,
  PaymentAllocationInput,
  PaymentOrigin,
} from "./payment-types.js";

export const paymentSelect = {
  allocations: {
    orderBy: { method: "asc" },
    select: {
      amountCents: true,
      id: true,
      method: true,
    },
  },
  amountCents: true,
  comandaId: true,
  creditOrderId: true,
  id: true,
  origin: true,
  paidAt: true,
  recordedByUser: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PaymentSelect;

type PersistedPayment = Prisma.PaymentGetPayload<{
  select: typeof paymentSelect;
}>;

export function mapPayment(payment: PersistedPayment): Payment {
  const { recordedByUser, ...persisted } = payment;
  return {
    ...persisted,
    paidAt: payment.paidAt.toISOString(),
    recordedBy: recordedByUser,
  };
}

export async function createPayment(
  transaction: Prisma.TransactionClient,
  data: {
    actorUserId: string;
    allocations: PaymentAllocationInput[];
    amountCents: number;
    comandaId: string;
    creditOrderId?: string;
    establishmentId: string;
    origin: PaymentOrigin;
    paidAt: Date;
  },
) {
  return transaction.payment.create({
    data: {
      allocations: {
        create: data.allocations.map((allocation) => ({
          amountCents: allocation.amountCents,
          establishment: { connect: { id: data.establishmentId } },
          method: allocation.method,
        })),
      },
      amountCents: data.amountCents,
      comanda: {
        connect: {
          id_establishmentId: {
            establishmentId: data.establishmentId,
            id: data.comandaId,
          },
        },
      },
      creditOrder: data.creditOrderId
        ? {
            connect: {
              id_establishmentId: {
                establishmentId: data.establishmentId,
                id: data.creditOrderId,
              },
            },
          }
        : undefined,
      establishment: { connect: { id: data.establishmentId } },
      origin: data.origin,
      paidAt: data.paidAt,
      recordedByUser: {
        connect: {
          id_establishmentId: {
            establishmentId: data.establishmentId,
            id: data.actorUserId,
          },
        },
      },
    },
    select: paymentSelect,
  });
}
