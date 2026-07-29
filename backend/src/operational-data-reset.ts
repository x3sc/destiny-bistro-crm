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
    const creditOrders = await transaction.creditOrder.deleteMany({
      where: { establishmentId },
    });
    const settlements = await transaction.creditSettlement.deleteMany({
      where: { establishmentId },
    });
    const creditCustomers = await transaction.creditCustomer.deleteMany({
      where: { establishmentId },
    });
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
      settlements: settlements.count,
    };
  });
}
