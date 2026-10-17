import type { KitchenRepository } from "./kitchen-types.js";
import type { RestaurantTableRepository } from "./restaurant-table-repository.js";
import { parseStatementPeriod } from "./statement-report.js";
import type { StatementRepository } from "./statement-repository.js";

const operationalTimeZone = "America/Sao_Paulo";

export interface DashboardMetricPermissions {
  kitchen: boolean;
  sales: boolean;
  tables: boolean;
}

export interface TodayDashboard {
  closedSalesCents: number | null;
  date: string;
  occupiedTables: number | null;
  pendingKitchenTickets: number | null;
}

export interface DashboardRepository {
  findToday(
    establishmentId: string,
    permissions: DashboardMetricPermissions,
  ): Promise<TodayDashboard>;
}

export function createDashboardRepository(
  tables: RestaurantTableRepository,
  kitchen: KitchenRepository,
  statements: StatementRepository,
  now: () => Date = () => new Date(),
): DashboardRepository {
  return {
    async findToday(establishmentId, permissions) {
      const date = operationalDateKey(now());
      const [tableRows, kitchenTickets, statement] = await Promise.all([
        permissions.tables ? tables.list(establishmentId) : null,
        permissions.kitchen ? kitchen.listOperational(establishmentId) : null,
        permissions.sales
          ? statements.findReport(
              establishmentId,
              parseStatementPeriod(date, date),
            )
          : null,
      ]);

      return {
        closedSalesCents: statement?.summary.soldCents ?? null,
        date,
        occupiedTables:
          tableRows?.filter(
            ({ status }) => status === "OPEN" || status === "AWAITING_CHECK",
          ).length ?? null,
        pendingKitchenTickets:
          kitchenTickets?.filter(({ status }) => status === "PENDING").length ??
          null,
      };
    },
  };
}

function operationalDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: operationalTimeZone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;

  return [part("year"), part("month"), part("day")].join("-");
}
