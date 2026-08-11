import { type Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { createAuditData } from "./audit.js";
import {
  calculateDayPayoutCents,
  DeliveryCourierConflictError,
  DeliveryCourierNotFoundError,
  DeliveryDayConflictError,
  DeliveryDayNotFoundError,
  normalizeCourierName,
  type DeliveryCourierDetails,
  type DeliveryCourierSummary,
  type DeliveryDayDetails,
  type DeliveryDaySummary,
  type DeliveryExpenseInput,
  type DeliveryInput,
  type DeliveryPeriod,
  type DeliveryRepository,
} from "./delivery-types.js";

export * from "./delivery-types.js";

const actorSelect = {
  select: {
    id: true,
    name: true,
  },
} satisfies Prisma.UserDefaultArgs;

const deliveryDaySelect = {
  closedAt: true,
  courier: {
    select: {
      id: true,
      name: true,
    },
  },
  courierId: true,
  dailyRateCents: true,
  deliveries: {
    orderBy: { deliveredAt: "asc" },
    select: {
      actorUser: actorSelect,
      address: true,
      customerName: true,
      deliveredAt: true,
      feeCents: true,
      id: true,
      paymentMethod: true,
      products: true,
      totalCents: true,
    },
  },
  expenses: {
    orderBy: { createdAt: "asc" },
    select: {
      actorUser: actorSelect,
      amountCents: true,
      createdAt: true,
      description: true,
      id: true,
    },
  },
  id: true,
  openedAt: true,
  settlementPaidCents: true,
  status: true,
} satisfies Prisma.DeliveryDaySelect;

type PersistedDeliveryDay = Prisma.DeliveryDayGetPayload<{
  select: typeof deliveryDaySelect;
}>;

type TransactionClient = Prisma.TransactionClient;

function mapDay(day: PersistedDeliveryDay): DeliveryDayDetails {
  const feesTotalCents = day.deliveries.reduce(
    (total, delivery) => total + delivery.feeCents,
    0,
  );
  const salesTotalCents = day.deliveries.reduce(
    (total, delivery) => total + delivery.totalCents,
    0,
  );
  const expensesTotalCents = day.expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );

  return {
    closedAt: day.closedAt?.toISOString() ?? null,
    courierId: day.courierId,
    courierName: day.courier.name,
    dailyRateCents: day.dailyRateCents,
    deliveries: day.deliveries.map((delivery) => ({
      address: delivery.address,
      customerName: delivery.customerName,
      deliveredAt: delivery.deliveredAt.toISOString(),
      feeCents: delivery.feeCents,
      id: delivery.id,
      paymentMethod: delivery.paymentMethod,
      products: delivery.products,
      recordedBy: delivery.actorUser
        ? { id: delivery.actorUser.id, name: delivery.actorUser.name }
        : null,
      totalCents: delivery.totalCents,
    })),
    deliveryCount: day.deliveries.length,
    expenses: day.expenses.map((expense) => ({
      amountCents: expense.amountCents,
      createdAt: expense.createdAt.toISOString(),
      description: expense.description,
      id: expense.id,
      recordedBy: expense.actorUser
        ? { id: expense.actorUser.id, name: expense.actorUser.name }
        : null,
    })),
    expensesTotalCents,
    feesTotalCents,
    id: day.id,
    openedAt: day.openedAt.toISOString(),
    payoutCents: calculateDayPayoutCents({
      dailyRateCents: day.dailyRateCents,
      expensesTotalCents,
      feesTotalCents,
    }),
    salesTotalCents,
    settlementPaidCents: day.settlementPaidCents,
    status: day.status,
  };
}

function toDaySummary(day: DeliveryDayDetails): DeliveryDaySummary {
  return {
    closedAt: day.closedAt,
    courierId: day.courierId,
    courierName: day.courierName,
    dailyRateCents: day.dailyRateCents,
    deliveryCount: day.deliveryCount,
    expensesTotalCents: day.expensesTotalCents,
    feesTotalCents: day.feesTotalCents,
    id: day.id,
    openedAt: day.openedAt,
    payoutCents: day.payoutCents,
    salesTotalCents: day.salesTotalCents,
    settlementPaidCents: day.settlementPaidCents,
    status: day.status,
  };
}

async function getDayOrThrow(
  client: PrismaClient | TransactionClient,
  establishmentId: string,
  dayId: string,
) {
  const day = await client.deliveryDay.findFirst({
    select: deliveryDaySelect,
    where: { establishmentId, id: dayId },
  });

  if (!day) {
    throw new DeliveryDayNotFoundError();
  }

  return mapDay(day);
}

async function getOpenDayOrThrow(
  transaction: TransactionClient,
  establishmentId: string,
  dayId: string,
) {
  const day = await transaction.deliveryDay.findFirst({
    select: { id: true, status: true },
    where: { establishmentId, id: dayId },
  });

  if (!day) {
    throw new DeliveryDayNotFoundError();
  }

  if (day.status !== "OPEN") {
    throw new DeliveryDayConflictError();
  }

  return day;
}

export function createDeliveryRepository(
  prisma: PrismaClient,
): DeliveryRepository {
  return {
    async addExpense(
      establishmentId: string,
      dayId: string,
      input: DeliveryExpenseInput,
      actorUserId: string,
    ) {
      return prisma.$transaction(async (transaction) => {
        await getOpenDayOrThrow(transaction, establishmentId, dayId);

        const expense = await transaction.deliveryExpense.create({
          data: {
            actorUserId,
            amountCents: input.amountCents,
            dayId,
            description: input.description,
            establishmentId,
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: createAuditData({
            action: "DELIVERY_EXPENSE_RECORDED",
            establishmentId,
            metadata: { amountCents: input.amountCents, dayId },
            resourceId: expense.id,
            resourceType: "DELIVERY_EXPENSE",
            userId: actorUserId,
          }),
        });

        return getDayOrThrow(transaction, establishmentId, dayId);
      });
    },

    async closeDay(
      establishmentId: string,
      dayId: string,
      actorUserId: string,
    ) {
      return prisma.$transaction(async (transaction) => {
        await getOpenDayOrThrow(transaction, establishmentId, dayId);

        const day = await getDayOrThrow(transaction, establishmentId, dayId);
        const closedAt = new Date();
        const closed = await transaction.deliveryDay.updateMany({
          data: {
            closedAt,
            closedByUserId: actorUserId,
            settlementPaidCents: day.payoutCents,
            status: "CLOSED",
          },
          where: { establishmentId, id: dayId, status: "OPEN" },
        });

        if (closed.count !== 1) {
          throw new DeliveryDayConflictError();
        }

        await transaction.auditLog.create({
          data: createAuditData({
            action: "DELIVERY_DAY_CLOSED",
            establishmentId,
            metadata: {
              courierId: day.courierId,
              dailyRateCents: day.dailyRateCents,
              expensesTotalCents: day.expensesTotalCents,
              feesTotalCents: day.feesTotalCents,
              settlementPaidCents: day.payoutCents,
            },
            resourceId: dayId,
            resourceType: "DELIVERY_DAY",
            userId: actorUserId,
          }),
        });

        return getDayOrThrow(transaction, establishmentId, dayId);
      });
    },

    async createCourier(
      establishmentId: string,
      name: string,
      actorUserId: string,
    ) {
      const normalized = normalizeCourierName(name);

      return prisma.$transaction(async (transaction) => {
        const existing = await transaction.deliveryCourier.findFirst({
          select: { id: true },
          where: {
            establishmentId,
            normalizedName: normalized.normalizedName,
          },
        });

        if (existing) {
          throw new DeliveryCourierConflictError();
        }

        const courier = await transaction.deliveryCourier.create({
          data: {
            establishmentId,
            name: normalized.name,
            normalizedName: normalized.normalizedName,
          },
          select: { id: true, name: true },
        });

        await transaction.auditLog.create({
          data: createAuditData({
            action: "DELIVERY_COURIER_CREATED",
            establishmentId,
            resourceId: courier.id,
            resourceType: "DELIVERY_COURIER",
            userId: actorUserId,
          }),
        });

        return {
          activeDayId: null,
          id: courier.id,
          name: courier.name,
          settledTotalCents: 0,
        };
      });
    },

    async findCourier(
      establishmentId: string,
      courierId: string,
      period?: DeliveryPeriod,
    ): Promise<DeliveryCourierDetails> {
      const courier = await prisma.deliveryCourier.findFirst({
        select: { id: true, name: true },
        where: { establishmentId, id: courierId },
      });

      if (!courier) {
        throw new DeliveryCourierNotFoundError();
      }

      const days = await prisma.deliveryDay.findMany({
        orderBy: { openedAt: "desc" },
        select: deliveryDaySelect,
        where: {
          courierId,
          establishmentId,
          ...(period
            ? { openedAt: { gte: period.startAt, lt: period.endAt } }
            : {}),
        },
      });
      const mappedDays = days.map((day) => toDaySummary(mapDay(day)));
      const activeDay = mappedDays.find((day) => day.status === "OPEN");
      const settledTotal = await prisma.deliveryDay.aggregate({
        _sum: { settlementPaidCents: true },
        where: { courierId, establishmentId, status: "CLOSED" },
      });

      return {
        activeDayId: activeDay?.id ?? null,
        days: mappedDays,
        id: courier.id,
        name: courier.name,
        periodPayoutCents: mappedDays.reduce(
          (total, day) => total + day.payoutCents,
          0,
        ),
        periodSettledCents: mappedDays.reduce(
          (total, day) => total + (day.settlementPaidCents ?? 0),
          0,
        ),
        settledTotalCents: settledTotal._sum.settlementPaidCents ?? 0,
      };
    },

    async findDay(establishmentId: string, dayId: string) {
      return getDayOrThrow(prisma, establishmentId, dayId);
    },

    async listCouriers(establishmentId: string) {
      const couriers = await prisma.deliveryCourier.findMany({
        orderBy: { name: "asc" },
        select: {
          days: {
            select: { id: true },
            where: { status: "OPEN" },
          },
          id: true,
          name: true,
        },
        where: { active: true, establishmentId },
      });
      const settledTotals = await prisma.deliveryDay.groupBy({
        _sum: { settlementPaidCents: true },
        by: ["courierId"],
        where: { establishmentId, status: "CLOSED" },
      });
      const settledByCourier = new Map(
        settledTotals.map((total) => [
          total.courierId,
          total._sum.settlementPaidCents ?? 0,
        ]),
      );

      return couriers.map<DeliveryCourierSummary>((courier) => ({
        activeDayId: courier.days[0]?.id ?? null,
        id: courier.id,
        name: courier.name,
        settledTotalCents: settledByCourier.get(courier.id) ?? 0,
      }));
    },

    async openDay(
      establishmentId: string,
      courierId: string,
      dailyRateCents: number,
      actorUserId: string,
    ) {
      return prisma.$transaction(async (transaction) => {
        const courier = await transaction.deliveryCourier.findFirst({
          select: { id: true },
          where: { active: true, establishmentId, id: courierId },
        });

        if (!courier) {
          throw new DeliveryCourierNotFoundError();
        }

        const openDay = await transaction.deliveryDay.findFirst({
          select: { id: true },
          where: { courierId, establishmentId, status: "OPEN" },
        });

        if (openDay) {
          throw new DeliveryDayConflictError();
        }

        const day = await transaction.deliveryDay.create({
          data: {
            courierId,
            dailyRateCents,
            establishmentId,
            openedByUserId: actorUserId,
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: createAuditData({
            action: "DELIVERY_DAY_OPENED",
            establishmentId,
            metadata: { courierId, dailyRateCents },
            resourceId: day.id,
            resourceType: "DELIVERY_DAY",
            userId: actorUserId,
          }),
        });

        return getDayOrThrow(transaction, establishmentId, day.id);
      });
    },

    async recordDelivery(
      establishmentId: string,
      dayId: string,
      input: DeliveryInput,
      actorUserId: string,
    ) {
      return prisma.$transaction(async (transaction) => {
        await getOpenDayOrThrow(transaction, establishmentId, dayId);

        const delivery = await transaction.delivery.create({
          data: {
            actorUserId,
            address: input.address,
            customerName: input.customerName,
            dayId,
            establishmentId,
            feeCents: input.feeCents,
            paymentMethod: input.paymentMethod,
            products: input.products,
            totalCents: input.totalCents,
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: createAuditData({
            action: "DELIVERY_RECORDED",
            establishmentId,
            metadata: {
              dayId,
              feeCents: input.feeCents,
              paymentMethod: input.paymentMethod,
              totalCents: input.totalCents,
            },
            resourceId: delivery.id,
            resourceType: "DELIVERY",
            userId: actorUserId,
          }),
        });

        return getDayOrThrow(transaction, establishmentId, dayId);
      });
    },
  };
}
