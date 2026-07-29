import type { PrismaClient } from "./generated/prisma/client.js";

export async function resetOperationalData(prisma: PrismaClient) {
  return prisma.$transaction(async (transaction) => {
    await transaction.restaurantTable.updateMany({
      data: {
        activeComandaId: null,
        status: "FREE",
      },
    });
    const creditOrders = await transaction.creditOrder.deleteMany();
    const settlements = await transaction.creditSettlement.deleteMany();
    const creditCustomers = await transaction.creditCustomer.deleteMany();
    const comandaItems = await transaction.comandaItem.deleteMany();
    const comandaEvents = await transaction.comandaEvent.deleteMany();
    const comandas = await transaction.comanda.deleteMany();
    const auditLogs = await transaction.auditLog.deleteMany({
      where: {
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
