const STATEMENT_TIME_ZONE = "America/Sao_Paulo";
const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export type StatementOrigin = "TABLE" | "CREDIT_MANUAL" | "CREDIT_TABLE";
export type StatementEvent =
  | "TABLE_CLOSED"
  | "CREDIT_FINALIZED"
  | "CREDIT_ADDITION"
  | "CREDIT_SETTLED"
  | "COMANDA_CANCELLED";
export type StatementComandaStatus = "OPEN" | "CLOSED" | "CANCELLED";

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
  comandaNumber: number;
  event: StatementEvent;
  id: string;
  occurredAt: string;
  origin: StatementOrigin;
  receivedCents: number;
  receivedItemCount: number;
  soldCents: number;
  soldItemCount: number;
  status: StatementComandaStatus;
  tableNumber: number | null;
}

export interface StatementReport {
  days: StatementDay[];
  entries: StatementEntry[];
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
  id: string;
  name: string | null;
  number: number;
  status: StatementComandaStatus;
  tableNumber: number | null;
}

interface SourceCreditIdentity {
  customerName: string;
  source: "MANUAL" | "TABLE";
}

export interface StatementSourceData {
  cancelledComandas: Array<
    SourceComandaIdentity & {
      cancelledAt: Date;
      creditOrder: SourceCreditIdentity | null;
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
      items: Array<{
        confirmedQuantity: number;
        quantity: number;
        unitPriceCents: number;
      }>;
    }
  >;
  creditOrders: Array<
    SourceCreditIdentity & {
      comanda: SourceComandaIdentity & {
        events: Array<{
          createdAt: Date;
          newQuantity: number;
          previousQuantity: number;
          unitPriceCents: number;
        }>;
      };
      finalizedAt: Date;
    }
  >;
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

    if (comanda.creditOrder) {
      entries.push(
        createEntry({
          comanda,
          event: "CREDIT_SETTLED",
          occurredAt: comanda.closedAt,
          origin: creditOrigin(comanda.creditOrder.source),
          receivedCents: comanda.creditOrder.settlementAmountCents,
          receivedItemCount: itemCount,
        }),
      );
    } else {
      entries.push(
        createEntry({
          comanda,
          event: "TABLE_CLOSED",
          occurredAt: comanda.closedAt,
          origin: "TABLE",
          receivedCents: tableTotalCents,
          receivedItemCount: itemCount,
          soldCents: tableTotalCents,
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
        event: "COMANDA_CANCELLED",
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

    if (isWithinPeriod(order.finalizedAt, period)) {
      const initial = totalConfirmationEvents(initialEvents);

      entries.push(
        createEntry({
          comanda: order.comanda,
          event: "CREDIT_FINALIZED",
          occurredAt: order.finalizedAt,
          origin: creditOrigin(order.source),
          soldCents: initial.totalCents,
          soldItemCount: initial.itemCount,
        }),
      );
    }

    for (const event of order.comanda.events) {
      if (
        event.createdAt.getTime() <= order.finalizedAt.getTime() ||
        !isWithinPeriod(event.createdAt, period)
      ) {
        continue;
      }

      const itemCount = event.newQuantity - event.previousQuantity;
      if (itemCount <= 0) {
        continue;
      }

      entries.push(
        createEntry({
          comanda: order.comanda,
          event: "CREDIT_ADDITION",
          occurredAt: event.createdAt,
          origin: creditOrigin(order.source),
          soldCents: itemCount * event.unitPriceCents,
          soldItemCount: itemCount,
        }),
      );
    }
  }

  entries.sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.comandaNumber - right.comandaNumber ||
      left.event.localeCompare(right.event),
  );

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
  event,
  occurredAt,
  origin,
  receivedCents = 0,
  receivedItemCount = 0,
  soldCents = 0,
  soldItemCount = 0,
}: {
  comanda: SourceComandaIdentity;
  event: StatementEvent;
  occurredAt: Date;
  origin: StatementOrigin;
  receivedCents?: number;
  receivedItemCount?: number;
  soldCents?: number;
  soldItemCount?: number;
}): StatementEntry {
  const occurredAtIso = occurredAt.toISOString();

  return {
    comandaId: comanda.id,
    comandaName: comanda.name,
    comandaNumber: comanda.number,
    event,
    id: `${event}:${comanda.id}:${occurredAtIso}`,
    occurredAt: occurredAtIso,
    origin,
    receivedCents,
    receivedItemCount,
    soldCents,
    soldItemCount,
    status: comanda.status,
    tableNumber: comanda.tableNumber,
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

  if (entry.event === "TABLE_CLOSED" || entry.event === "CREDIT_SETTLED") {
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
  return events.reduce(
    (total, event) => {
      const itemCount = event.newQuantity - event.previousQuantity;
      if (itemCount > 0) {
        total.itemCount += itemCount;
        total.totalCents += itemCount * event.unitPriceCents;
      }
      return total;
    },
    {
      itemCount: 0,
      totalCents: 0,
    },
  );
}

function creditOrigin(source: "MANUAL" | "TABLE"): StatementOrigin {
  return source === "MANUAL" ? "CREDIT_MANUAL" : "CREDIT_TABLE";
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
