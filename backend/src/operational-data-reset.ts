import type { PrismaClient } from "./generated/prisma/client.js";

export async function resetOperationalData(
  prisma: PrismaClient,
  establishmentId: string,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.restaurantTable.updateMany({
      data: {
        activeComandaId: null,
        status: "FREE",
      },
      where: { establishmentId },
    });
    await transaction.paymentAllocation.deleteMany({
      where: { establishmentId },
    });
    const payments = await transaction.payment.deleteMany({
      where: { establishmentId },
    });
    const creditOrders = await transaction.creditOrder.deleteMany({
      where: { establishmentId },
    });
    const creditCustomers = await transaction.creditCustomer.deleteMany({
      where: { establishmentId },
    });
    const deliveryOrders = await transaction.deliveryOrder.deleteMany({
      where: { establishmentId },
    });
    await transaction.inventoryOperation.updateMany({
      data: { comandaId: null },
      where: { establishmentId, comandaId: { not: null } },
    });
    await transaction.kitchenTicketItemAdditional.deleteMany({
      where: { establishmentId },
    });
    await transaction.kitchenTicketItemConfiguration.deleteMany({
      where: { establishmentId },
    });
    await transaction.kitchenTicketItem.deleteMany({
      where: { establishmentId },
    });
    const kitchenTickets = await transaction.kitchenTicket.deleteMany({
      where: { establishmentId },
    });
    await transaction.comandaItemCancellation.deleteMany({ where: { establishmentId } });
    await transaction.comandaItemAdditional.deleteMany({ where: { establishmentId } });
    await transaction.comandaItemConfiguration.deleteMany({ where: { establishmentId } });
    const comandaItems = await transaction.comandaItem.deleteMany({
      where: { establishmentId },
    });
    const comandaEvents = await transaction.comandaEvent.deleteMany({
      where: { establishmentId },
    });
    const comandas = await transaction.comanda.deleteMany({
      where: { establishmentId },
    });
    const auditLogs = await transaction.auditLog.deleteMany({
      where: {
        establishmentId,
        resourceType: {
          in: [
            "COMANDA",
            "COMANDA_ITEM",
            "CREDIT_CUSTOMER",
            "CREDIT_ORDER",
            "DELIVERY_ORDER",
            "KITCHEN_TICKET",
          ],
        },
      },
    });

    return {
      auditLogs: auditLogs.count,
      comandas: comandas.count,
      comandaEvents: comandaEvents.count,
      comandaItems: comandaItems.count,
      creditCustomers: creditCustomers.count,
      creditOrders: creditOrders.count,
      deliveryOrders: deliveryOrders.count,
      kitchenTickets: kitchenTickets.count,
      payments: payments.count,
    };
  });
}
