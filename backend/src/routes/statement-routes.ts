import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import {
  createStatementPdf,
  type StatementPdfView,
} from "../statement-pdf.js";
import {
  parseStatementPeriod,
  StatementPeriodError,
  type StatementEntryFilters,
  type StatementMovementType,
  type StatementOriginFilter,
} from "../statement-report.js";
import type { StatementRepository } from "../statement-repository.js";

interface StatementQuery {
  from?: string;
  movementType?: string;
  origin?: string;
  to?: string;
  view?: string;
}

export function registerStatementRoutes(
  app: FastifyInstance,
  statements: StatementRepository,
) {
  app.get<{ Querystring: StatementQuery }>(
    "/statements",
    { config: { permission: "statements.read" } },
    async (request, reply) => {
      const period = parsePeriodOrReply(request.query, reply);
      if (!period) {
        return;
      }
      try {
        return {
          statement: await statements.findReport(
            requireAuthUser(request).establishment.id,
            period,
          ),
        };
      } catch (error) {
        app.log.error(error, "Statement query failed");
        return reply.code(503).send({
          message: "Statement unavailable",
          status: "error",
        });
      }
    },
  );

  app.get<{ Querystring: StatementQuery }>(
    "/statements/export.pdf",
    { config: { permission: "statements.read" } },
    async (request, reply) => {
      const period = parsePeriodOrReply(request.query, reply);
      if (!period) {
        return;
      }
      const view = parseViewOrReply(request.query.view, reply);
      if (!view) {
        return;
      }
      const filters = parseFiltersOrReply(request.query, reply);
      if (!filters) {
        return;
      }

      try {
        const report = await statements.findReport(
          requireAuthUser(request).establishment.id,
          period,
        );
        const pdf = await createStatementPdf(report, view, filters);
        const viewLabel = view === "summary" ? "resumido" : "detalhado";

        return reply
          .header(
            "Content-Disposition",
            `attachment; filename="extrato-${viewLabel}-${period.from}-a-${period.to}.pdf"`,
          )
          .type("application/pdf")
          .send(pdf);
      } catch (error) {
        app.log.error(error, "Statement PDF export failed");
        return reply.code(503).send({
          message: "Statement export unavailable",
          status: "error",
        });
      }
    },
  );
}

function parseFiltersOrReply(
  query: StatementQuery,
  reply: {
    code(statusCode: number): {
      send(payload: { message: string; status: string }): unknown;
    };
  },
): StatementEntryFilters | null {
  const movementType = query.movementType ?? "ALL";
  const origin = query.origin ?? "ALL";
  if (!isStatementMovementType(movementType) || !isStatementOriginFilter(origin)) {
    reply.code(400).send({
      message: "Invalid statement filters",
      status: "error",
    });
    return null;
  }
  return { movementType, origin };
}

function isStatementMovementType(value: string): value is StatementMovementType {
  return ["ALL", "SALES", "RECEIPTS", "CANCELLATIONS"].includes(value);
}

function isStatementOriginFilter(value: string): value is StatementOriginFilter {
  return ["ALL", "TABLE", "CREDIT_MANUAL", "CREDIT_TABLE"].includes(value);
}

function parseViewOrReply(
  value: string | undefined,
  reply: {
    code(statusCode: number): {
      send(payload: { message: string; status: string }): unknown;
    };
  },
): StatementPdfView | null {
  if (value === undefined || value === "detailed") {
    return "detailed";
  }
  if (value === "summary") {
    return "summary";
  }
  reply.code(400).send({
    message: "Invalid statement view",
    status: "error",
  });
  return null;
}

function parsePeriodOrReply(
  query: StatementQuery,
  reply: {
    code(statusCode: number): {
      send(payload: { message: string; status: string }): unknown;
    };
  },
) {
  try {
    return parseStatementPeriod(query.from, query.to);
  } catch (error) {
    if (error instanceof StatementPeriodError) {
      reply.code(400).send({
        message: "Invalid statement period",
        status: "error",
      });
      return null;
    }

    throw error;
  }
}
