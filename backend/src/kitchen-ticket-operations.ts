import { createAuditData } from "./audit.js";
import type { Transaction } from "./comanda-persistence.js";

export interface PendingKitchenConfiguration {
  additionals: {
    additionalId: string;
    additionalName: string;
    quantityPerUnit: number;
  }[];
  configurationKey: string;
  quantity: number;
  sourceConfigurationId: string;
}

export async function createKitchenTicketForConfirmation(
  transaction: Transaction,
  input: {
    actorUserId: string;
    comandaId: string;
    comandaItemId: string;
    confirmationKey: string;
    configurations: PendingKitchenConfiguration[];
    establishmentId: string;
    productId: string;
    productName: string;
    quantity: number;
  },
) {
  const ticket = await transaction.kitchenTicket.create({
    data: {
      comandaId: input.comandaId,
      confirmationKey: input.confirmationKey,
      establishmentId: input.establishmentId,
      items: {
        create: {
          comandaItemId: input.comandaItemId,
          configurations: {
            create: input.configurations.map((configuration) => ({
              additionals: {
                create: configuration.additionals,
              },
              configurationKey: configuration.configurationKey,
              quantity: configuration.quantity,
              sourceConfigurationId: configuration.sourceConfigurationId,
            })),
          },
          productId: input.productId,
          productName: input.productName,
          quantity: input.quantity,
        },
      },
    },
    select: { id: true },
  });
  await transaction.auditLog.create({
    data: createAuditData({
      action: "KITCHEN_TICKET_CREATED",
      establishmentId: input.establishmentId,
      metadata: {
        comandaId: input.comandaId,
        comandaItemId: input.comandaItemId,
        confirmationKey: input.confirmationKey,
        quantity: input.quantity,
      },
      resourceId: ticket.id,
      resourceType: "KITCHEN_TICKET",
      userId: input.actorUserId,
    }),
  });
  return ticket.id;
}
