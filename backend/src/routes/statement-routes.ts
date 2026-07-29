import type { FastifyInstance } from "fastify";
import { requireAuthUser } from "../authentication.js";
import { createStatementPdf } from "../statement-pdf.js";
import {
  parseStatementPeriod,
  StatementPeriodError,
} from "../statement-report.js";
import type { StatementRepository } from "../statement-repository.js";

interface StatementQuery {
  from?: string;
  to?: string;
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

      try {
        const report = await statements.findReport(
          requireAuthUser(request).establishment.id,
          period,
        );
        const pdf = await createStatementPdf(report);

        return reply
          .header(
            "Content-Disposition",
            `attachment; filename="extrato-${period.from}-a-${period.to}.pdf"`,
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
