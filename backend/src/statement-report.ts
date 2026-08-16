const STATEMENT_TIME_ZONE = "America/Sao_Paulo";
const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export type StatementOrigin =
  | "TABLE"
  | "CREDIT_MANUAL"
  | "CREDIT_TABLE"
  | "DELIVERY";
export type StatementEvent =
  | "TABLE_CLOSED"
  | "CREDIT_FINALIZED"
  | "CREDIT_ADDITION"
  | "CREDIT_PAYMENT"
  | "CREDIT_SETTLED"
  | "COMANDA_CANCELLED"
  | "DELIVERY_RECORDED";
export type StatementComandaStatus = "OPEN" | "CLOSED" | "CANCELLED";
export type StatementMovementType =
  | "ALL"
  | "SALES"
  | "RECEIPTS"
  | "CANCELLATIONS";
export type StatementOriginFilter = StatementOrigin | "ALL";

export interface StatementEntryFilters {
  movementType: StatementMovementType;
  origin: StatementOriginFilter;
}

export interface StatementSummary {
  cancelledCommandCount: number;
  closedCommandCount: number;
  processedCommandCount: number;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
}

export interface StatementDay extends StatementSummary {
  date: string;
}

export interface StatementEntry {
  comandaId: string;
  comandaName: string | null;
  comandaNumber: number | null;
  creditBalanceAfterCents: number | null;
  creditPaidAfterCents: number | null;
  creditPaidBeforeCents: number | null;
  creditTotalCents: number | null;
  customerName: string | null;
  deliveryAddress: string | null;
  deliveryFeeCents: number | null;
  event: StatementEvent;
  id: string;
  items: StatementEntryItem[];
  occurredAt: string;
  origin: StatementOrigin;
  payments: StatementPaymentAllocation[];
  paymentOrigin: StatementPaymentOrigin | null;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
  status: StatementComandaStatus;
  tableNumber: number | null;
  tableCheckoutPaidCents: number | null;
}

export type StatementPaymentOrigin =
  | "TABLE_CHECKOUT"
  | "CREDIT_INSTALLMENT"
  | "DELIVERY_PAYMENT";

export interface StatementPaymentAllocation {
  amountCents: number;
  method: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD";
}

export interface StatementEntryItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface StatementOriginSummary {
  movementCount: number;
  origin: StatementOrigin;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
}

export interface StatementIndicators {
  averageTicketCents: number;
  differenceCents: number;
  originSummaries: StatementOriginSummary[];
  paymentMethodSummaries: StatementPaymentMethodSummary[];
  saleCommandCount: number;
}

export interface StatementPaymentMethodSummary {
  method: StatementPaymentAllocation["method"] | "UNSPECIFIED";
  receivedCents: number;
}

export interface StatementReport {
  days: StatementDay[];
  entries: StatementEntry[];
  indicators: StatementIndicators;
  period: {
    from: string;
    timeZone: typeof STATEMENT_TIME_ZONE;
    to: string;
  };
  summary: StatementSummary;
}

export interface StatementPeriod {
  endAt: Date;
  from: string;
  startAt: Date;
  to: string;
}

interface SourceComandaIdentity {
  deliveryOrder?: {
    address: string;
    feeCents: number;
  } | null;
  id: string;
  name: string | null;
  number: number;
  status: StatementComandaStatus;
  tableNumber: number | null;
}

interface SourceCreditIdentity {
  customerName: string;
  source: "MANUAL" | "TABLE" | "DELIVERY";
}

interface SourcePayment {
  allocations: StatementPaymentAllocation[];
  amountCents: number;
  id: string;
  origin?: StatementPaymentOrigin | "DELIVERY_CHECKOUT";
  paidAt: Date;
}

interface SourceItem {
  confirmedQuantity: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface SourceDelivery {
  address: string;
  courierName: string;
  customerName: string;
  deliveredAt: Date;
  feeCents: number;
  id: string;
  paymentMethod: StatementPaymentAllocation["method"];
  totalCents: number;
}

export interface StatementSourceData {
  cancelledComandas: Array<
    SourceComandaIdentity & {
      cancelledAt: Date;
      creditOrder: SourceCreditIdentity | null;
      items: SourceItem[];
    }
  >;
  closedComandas: Array<
    SourceComandaIdentity & {
      closedAt: Date;
      creditOrder:
        | (SourceCreditIdentity & {
            settlementAmountCents: number;
          })
        | null;
      items: SourceItem[];
      payments?: SourcePayment[];
    }
  >;
  creditOrders: Array<
    SourceCreditIdentity & {
      comanda: SourceComandaIdentity & {
        closedAt?: Date | null;
        events: Array<{
          createdAt: Date;
          newQuantity: number;
          previousQuantity: number;
          productId: string;
          productName: string;
          unitPriceCents: number;
        }>;
      };
      finalizedAt: Date;
      payments?: SourcePayment[];
    }
  >;
  deliveries?: SourceDelivery[];
}

export class StatementPeriodError extends Error {}

export function parseStatementPeriod(
  fromValue: string | undefined,
  toValue: string | undefined,
): StatementPeriod {
  if (!fromValue || !toValue) {
    throw new StatementPeriodError("Statement period is required");
  }

  validateDateKey(fromValue);
  validateDateKey(toValue);

  if (fromValue > toValue) {
    throw new StatementPeriodError("Statement period is inverted");
  }

  return {
    endAt: zonedMidnight(addDays(toValue, 1)),
    from: fromValue,
    startAt: zonedMidnight(fromValue),
    to: toValue,
  };
}

export function buildStatementReport(
  period: StatementPeriod,
  source: StatementSourceData,
): StatementReport {
  const entries: StatementEntry[] = [];

  for (const comanda of source.closedComandas) {
    if (!isWithinPeriod(comanda.closedAt, period)) {
      continue;
    }

    const itemCount = comanda.items.reduce(
      (total, item) => total + item.confirmedQuantity,
      0,
    );
    const tableTotalCents = comanda.items.reduce(
      (total, item) =>
        total + item.confirmedQuantity * item.unitPriceCents,
      0,
    );
    const totalCents = tableTotalCents + (comanda.deliveryOrder?.feeCents ?? 0);

    const comandaPayments = comanda.payments ?? [];
    if (comanda.creditOrder && comandaPayments.length === 0) {
      entries.push(
        createEntry({
          comanda,
          creditBalanceAfterCents: 0,
          creditPaidAfterCents: totalCents,
          creditPaidBeforeCents: Math.max(
            totalCents - comanda.creditOrder.settlementAmountCents,
            0,
          ),
          creditTotalCents: totalCents,
          customerName: comanda.creditOrder.customerName,
          deliveryAddress: comanda.deliveryOrder?.address ?? null,
          deliveryFeeCents: comanda.deliveryOrder?.feeCents ?? null,
          event: "CREDIT_SETTLED",
          items: entryItems(comanda.items, "confirmedQuantity"),
          occurredAt: comanda.closedAt,
          origin: creditOrigin(comanda.creditOrder.source),
          receivedCents: comanda.creditOrder.settlementAmountCents,
          receivedItemCount: itemCount,
          tableCheckoutPaidCents: 0,
        }),
      );
    } else if (!comanda.creditOrder) {
      const receivedCents =
        comandaPayments.length > 0
          ? comandaPayments.reduce(
              (total, payment) => total + payment.amountCents,
              0,
            )
          : totalCents;
      entries.push(
        createEntry({
          comanda,
          customerName: comanda.deliveryOrder ? comanda.name : null,
          deliveryAddress: comanda.deliveryOrder?.address ?? null,
          deliveryFeeCents: comanda.deliveryOrder?.feeCents ?? null,
          event: comanda.deliveryOrder ? "DELIVERY_RECORDED" : "TABLE_CLOSED",
          items: entryItems(comanda.items, "confirmedQuantity"),
          occurredAt: comanda.closedAt,
          origin: comanda.deliveryOrder ? "DELIVERY" : "TABLE",
          payments: comandaPayments.flatMap((payment) => payment.allocations),
          receivedCents,
          receivedItemCount: itemCount,
          soldCents: totalCents,
          soldItemCount: itemCount,
        }),
      );
    }
  }

  for (const comanda of source.cancelledComandas) {
    if (!isWithinPeriod(comanda.cancelledAt, period)) {
      continue;
    }

    entries.push(
      createEntry({
        comanda,
        customerName: comanda.creditOrder?.customerName ?? null,
        event: "COMANDA_CANCELLED",
        items: entryItems(comanda.items, "quantity"),
        occurredAt: comanda.cancelledAt,
        origin: comanda.creditOrder
          ? creditOrigin(comanda.creditOrder.source)
          : "TABLE",
      }),
    );
  }

  for (const order of source.creditOrders) {
    const initialEvents = order.comanda.events.filter(
      (event) => event.createdAt.getTime() <= order.finalizedAt.getTime(),
    );
    const initial = totalConfirmationEvents(initialEvents);
    const tableCheckoutPaidCents = (order.payments ?? [])
      .filter(
        (payment) =>
          payment.origin === "TABLE_CHECKOUT" ||
          payment.origin === "DELIVERY_CHECKOUT",
      )
      .reduce((total, payment) => total + payment.amountCents, 0);
    const creditTimeline = [
      createEntry({
        comanda: order.comanda,
        customerName: order.customerName,
        deliveryAddress: order.comanda.deliveryOrder?.address ?? null,
        deliveryFeeCents: order.comanda.deliveryOrder?.feeCents ?? null,
        event: "CREDIT_FINALIZED",
        items: initial.items,
        occurredAt: order.finalizedAt,
        origin: creditOrigin(order.source),
        soldCents:
          initial.totalCents + (order.comanda.deliveryOrder?.feeCents ?? 0),
        soldItemCount: initial.itemCount,
      }),
    ];

    for (const event of order.comanda.events) {
      if (
        event.createdAt.getTime() <= order.finalizedAt.getTime() ||
        event.newQuantity - event.previousQuantity <= 0
      ) {
        continue;
      }

      const itemCount = event.newQuantity - event.previousQuantity;
      creditTimeline.push(
        createEntry({
          comanda: order.comanda,
          customerName: order.customerName,
          event: "CREDIT_ADDITION",
          items: [confirmationEventItem(event, itemCount)],
          occurredAt: event.createdAt,
          origin: creditOrigin(order.source),
          soldCents: itemCount * event.unitPriceCents,
          soldItemCount: itemCount,
        }),
      );
    }

    for (const payment of order.payments ?? []) {
      const isFinalPayment =
        order.comanda.closedAt?.getTime() === payment.paidAt.getTime();
      creditTimeline.push(
        createEntry({
          comanda: order.comanda,
          customerName: order.customerName,
          entryId: payment.id,
          event: isFinalPayment ? "CREDIT_SETTLED" : "CREDIT_PAYMENT",
          occurredAt: payment.paidAt,
          origin: creditOrigin(order.source),
          payments: payment.allocations,
          paymentOrigin:
            payment.origin === "DELIVERY_CHECKOUT"
              ? "DELIVERY_PAYMENT"
              : (payment.origin ?? "CREDIT_INSTALLMENT"),
          receivedCents: payment.amountCents,
        }),
      );
    }

    creditTimeline.sort(compareStatementEntries);
    let creditPaidCents = 0;
    let creditTotalCents = 0;
    for (const entry of creditTimeline) {
      creditTotalCents += entry.soldCents;
      const creditPaidBeforeCents = creditPaidCents;
      creditPaidCents += entry.receivedCents;
      const creditBalanceCents = Math.max(
        creditTotalCents - creditPaidCents,
        0,
      );
      entry.creditTotalCents = creditTotalCents;
      entry.creditPaidBeforeCents = creditPaidBeforeCents;
      entry.creditPaidAfterCents = creditPaidCents;
      entry.creditBalanceAfterCents = creditBalanceCents;
      entry.tableCheckoutPaidCents = tableCheckoutPaidCents;
      if (entry.event === "CREDIT_FINALIZED" && tableCheckoutPaidCents > 0) {
        entry.creditPaidAfterCents = tableCheckoutPaidCents;
        entry.creditBalanceAfterCents = Math.max(
          creditTotalCents - tableCheckoutPaidCents,
          0,
        );
      }
      if (isWithinPeriod(new Date(entry.occurredAt), period)) {
        entries.push(entry);
      }
    }
  }

  for (const delivery of source.deliveries ?? []) {
    if (!isWithinPeriod(delivery.deliveredAt, period)) {
      continue;
    }

    entries.push(
      createEntry({
        comanda: {
          id: delivery.id,
          name: delivery.courierName,
          number: null,
          status: "CLOSED",
          tableNumber: null,
        },
        customerName: delivery.customerName,
        deliveryAddress: delivery.address,
        deliveryFeeCents: delivery.feeCents,
        event: "DELIVERY_RECORDED",
        occurredAt: delivery.deliveredAt,
        origin: "DELIVERY",
        payments: [
          { amountCents: delivery.totalCents, method: delivery.paymentMethod },
        ],
        paymentOrigin: "DELIVERY_PAYMENT",
        receivedCents: delivery.totalCents,
        soldCents: delivery.totalCents,
      }),
    );
  }

  entries.sort(compareStatementEntries);

  const days = createEmptyDays(period);
  const daysByDate = new Map(days.map((day) => [day.date, day]));

  for (const entry of entries) {
    const day = daysByDate.get(statementDateKey(new Date(entry.occurredAt)));
    if (!day) {
      continue;
    }

    addEntryToSummary(day, entry);
  }

  const summary = emptySummary();
  for (const day of days) {
    addSummary(summary, day);
  }

  return {
    days,
    entries,
    indicators: buildIndicators(entries, summary),
    period: {
      from: period.from,
      timeZone: STATEMENT_TIME_ZONE,
      to: period.to,
    },
    summary,
  };
}

function createEntry({
  comanda,
  creditBalanceAfterCents = null,
  creditPaidAfterCents = null,
  creditPaidBeforeCents = null,
  creditTotalCents = null,
  customerName = null,
  deliveryAddress = null,
  deliveryFeeCents = null,
  entryId,
  event,
  items = [],
  occurredAt,
  origin,
  payments = [],
  paymentOrigin = null,
  receivedCents = 0,
  receivedItemCount = 0,
  soldCents = 0,
  soldItemCount = 0,
  tableCheckoutPaidCents = null,
}: {
  comanda: Omit<SourceComandaIdentity, "number"> & { number: number | null };
  creditBalanceAfterCents?: number | null;
  creditPaidAfterCents?: number | null;
  creditPaidBeforeCents?: number | null;
  creditTotalCents?: number | null;
  customerName?: string | null;
  deliveryAddress?: string | null;
  deliveryFeeCents?: number | null;
  entryId?: string;
  event: StatementEvent;
  items?: StatementEntryItem[];
  occurredAt: Date;
  origin: StatementOrigin;
  payments?: StatementPaymentAllocation[];
  paymentOrigin?: StatementPaymentOrigin | null;
  receivedCents?: number;
  receivedItemCount?: number;
  soldCents?: number;
  soldItemCount?: number;
  tableCheckoutPaidCents?: number | null;
}): StatementEntry {
  const occurredAtIso = occurredAt.toISOString();

  return {
    comandaId: comanda.id,
    comandaName: comanda.name,
    comandaNumber: comanda.number,
    creditBalanceAfterCents,
    creditPaidAfterCents,
    creditPaidBeforeCents,
    creditTotalCents,
    customerName,
    deliveryAddress,
    deliveryFeeCents,
    event,
    id: `${event}:${comanda.id}:${entryId ?? occurredAtIso}`,
    items,
    occurredAt: occurredAtIso,
    origin,
    payments,
    paymentOrigin,
    receivedCents,
    receivedItemCount,
    soldCents,
    soldItemCount,
    status: comanda.status,
    tableNumber: comanda.tableNumber,
    tableCheckoutPaidCents,
  };
}

function createEmptyDays(period: StatementPeriod) {
  const days: StatementDay[] = [];
  let date = period.from;

  while (date <= period.to) {
    days.push({
      date,
      ...emptySummary(),
    });
    date = addDays(date, 1);
  }

  return days;
}

function emptySummary(): StatementSummary {
  return {
    cancelledCommandCount: 0,
    closedCommandCount: 0,
    processedCommandCount: 0,
    receivedCents: 0,
    receivedItemCount: 0,
    soldCents: 0,
    soldItemCount: 0,
  };
}

function addEntryToSummary(summary: StatementSummary, entry: StatementEntry) {
  summary.receivedCents += entry.receivedCents;
  summary.receivedItemCount += entry.receivedItemCount;
  summary.soldCents += entry.soldCents;
  summary.soldItemCount += entry.soldItemCount;

  if (
    entry.event === "TABLE_CLOSED" ||
    entry.event === "CREDIT_SETTLED" ||
    entry.event === "DELIVERY_RECORDED"
  ) {
    summary.closedCommandCount += 1;
    summary.processedCommandCount += 1;
  } else if (entry.event === "COMANDA_CANCELLED") {
    summary.cancelledCommandCount += 1;
    summary.processedCommandCount += 1;
  }
}

function addSummary(target: StatementSummary, source: StatementSummary) {
  target.cancelledCommandCount += source.cancelledCommandCount;
  target.closedCommandCount += source.closedCommandCount;
  target.processedCommandCount += source.processedCommandCount;
  target.receivedCents += source.receivedCents;
  target.receivedItemCount += source.receivedItemCount;
  target.soldCents += source.soldCents;
  target.soldItemCount += source.soldItemCount;
}

function totalConfirmationEvents(
  events: StatementSourceData["creditOrders"][number]["comanda"]["events"],
) {
  const totals = events.reduce(
    (total, event) => {
      const itemCount = event.newQuantity - event.previousQuantity;
      if (itemCount > 0) {
        total.itemCount += itemCount;
        total.totalCents += itemCount * event.unitPriceCents;
        addEntryItem(total.items, confirmationEventItem(event, itemCount));
      }
      return total;
    },
    {
      itemCount: 0,
      items: [] as StatementEntryItem[],
      totalCents: 0,
    },
  );

  return totals;
}

export function filterStatementEntries(
  entries: StatementEntry[],
  filters: StatementEntryFilters,
) {
  return entries.filter(
    (entry) =>
      matchesMovementType(entry, filters.movementType) &&
      (filters.origin === "ALL" || entry.origin === filters.origin),
  );
}

function matchesMovementType(
  entry: StatementEntry,
  movementType: StatementMovementType,
) {
  if (movementType === "SALES") {
    return entry.soldCents > 0;
  }
  if (movementType === "RECEIPTS") {
    return entry.receivedCents > 0;
  }
  if (movementType === "CANCELLATIONS") {
    return entry.event === "COMANDA_CANCELLED";
  }
  return true;
}

function compareStatementEntries(
  left: StatementEntry,
  right: StatementEntry,
) {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    (left.comandaNumber ?? 0) - (right.comandaNumber ?? 0) ||
    statementEventRank(left.event) - statementEventRank(right.event) ||
    left.id.localeCompare(right.id)
  );
}

function statementEventRank(event: StatementEvent) {
  return {
    CREDIT_FINALIZED: 0,
    CREDIT_ADDITION: 1,
    TABLE_CLOSED: 2,
    CREDIT_PAYMENT: 3,
    CREDIT_SETTLED: 4,
    COMANDA_CANCELLED: 5,
    DELIVERY_RECORDED: 6,
  }[event];
}

function entryItems(
  items: SourceItem[],
  quantityField: "confirmedQuantity" | "quantity",
) {
  return items
    .filter((item) => item[quantityField] > 0)
    .map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item[quantityField],
      unitPriceCents: item.unitPriceCents,
    }));
}

function confirmationEventItem(
  event: StatementSourceData["creditOrders"][number]["comanda"]["events"][number],
  quantity: number,
): StatementEntryItem {
  return {
    productId: event.productId,
    productName: event.productName,
    quantity,
    unitPriceCents: event.unitPriceCents,
  };
}

function addEntryItem(items: StatementEntryItem[], candidate: StatementEntryItem) {
  const existing = items.find(
    (item) =>
      item.productId === candidate.productId &&
      item.productName === candidate.productName &&
      item.unitPriceCents === candidate.unitPriceCents,
  );
  if (existing) {
    existing.quantity += candidate.quantity;
    return;
  }
  items.push({ ...candidate });
}

function buildIndicators(
  entries: StatementEntry[],
  summary: StatementSummary,
): StatementIndicators {
  const originSummaries: StatementOriginSummary[] = (
    ["TABLE", "CREDIT_MANUAL", "CREDIT_TABLE", "DELIVERY"] as const
  ).map((origin) => ({
    movementCount: 0,
    origin,
    receivedCents: 0,
    receivedItemCount: 0,
    soldCents: 0,
    soldItemCount: 0,
  }));
  const summariesByOrigin = new Map(
    originSummaries.map((originSummary) => [originSummary.origin, originSummary]),
  );
  const paymentMethodSummaries: StatementPaymentMethodSummary[] = (
    ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "UNSPECIFIED"] as const
  ).map((method) => ({ method, receivedCents: 0 }));
  const summariesByPaymentMethod = new Map(
    paymentMethodSummaries.map((methodSummary) => [
      methodSummary.method,
      methodSummary,
    ]),
  );
  const saleCommandIds = new Set<string>();

  for (const entry of entries) {
    const originSummary = summariesByOrigin.get(entry.origin);
    if (originSummary) {
      originSummary.movementCount += 1;
      originSummary.receivedCents += entry.receivedCents;
      originSummary.receivedItemCount += entry.receivedItemCount;
      originSummary.soldCents += entry.soldCents;
      originSummary.soldItemCount += entry.soldItemCount;
    }
    if (entry.soldCents > 0) {
      saleCommandIds.add(entry.comandaId);
    }

    let allocatedCents = 0;
    for (const payment of entry.payments) {
      allocatedCents += payment.amountCents;
      const methodSummary = summariesByPaymentMethod.get(payment.method);
      if (methodSummary) {
        methodSummary.receivedCents += payment.amountCents;
      }
    }
    const unspecifiedSummary = summariesByPaymentMethod.get("UNSPECIFIED");
    if (unspecifiedSummary) {
      unspecifiedSummary.receivedCents += Math.max(
        entry.receivedCents - allocatedCents,
        0,
      );
    }
  }

  const saleCommandCount = saleCommandIds.size;
  return {
    averageTicketCents:
      saleCommandCount === 0 ? 0 : Math.round(summary.soldCents / saleCommandCount),
    differenceCents: summary.soldCents - summary.receivedCents,
    originSummaries,
    paymentMethodSummaries,
    saleCommandCount,
  };
}

function creditOrigin(source: "MANUAL" | "TABLE" | "DELIVERY"): StatementOrigin {
  if (source === "MANUAL") return "CREDIT_MANUAL";
  if (source === "DELIVERY") return "DELIVERY";
  return "CREDIT_TABLE";
}

function isWithinPeriod(date: Date, period: StatementPeriod) {
  return date >= period.startAt && date < period.endAt;
}

function validateDateKey(value: string) {
  const match = dateKeyPattern.exec(value);
  if (!match) {
    throw new StatementPeriodError("Invalid statement date");
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new StatementPeriodError("Invalid statement date");
  }
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function zonedMidnight(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let instant = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = statementDateTimeParts(new Date(instant));
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const offset = representedAsUtc - instant;
    instant = targetAsUtc - offset;
  }

  return new Date(instant);
}

function statementDateKey(date: Date) {
  const parts = statementDateTimeParts(date);
  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0"),
  ].join("-");
}

function statementDateTimeParts(date: Date) {
  const values = new Map(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: STATEMENT_TIME_ZONE,
      year: "numeric",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return {
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    month: Number(values.get("month")),
    second: Number(values.get("second")),
    year: Number(values.get("year")),
  };
}
