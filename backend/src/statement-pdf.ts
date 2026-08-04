import PDFDocument from "pdfkit";
import type {
  StatementDay,
  StatementEntry,
  StatementEntryFilters,
  StatementMovementType,
  StatementOriginFilter,
  StatementReport,
} from "./statement-report.js";
import { filterStatementEntries } from "./statement-report.js";

const colors = {
  accent: "#76513d",
  background: "#f7f3ed",
  border: "#d8c5b4",
  muted: "#6c5d54",
  text: "#382b25",
};

const originLabels: Record<StatementEntry["origin"], string> = {
  CREDIT_MANUAL: "Fiado manual",
  CREDIT_TABLE: "Fiado de mesa",
  TABLE: "Mesa",
};

const statusLabels: Record<StatementEntry["status"], string> = {
  CANCELLED: "Cancelada",
  CLOSED: "Fechada",
  OPEN: "Em aberto",
};

const paymentMethodLabels = {
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  PIX: "Pix",
} as const;

const paymentSummaryLabels = {
  ...paymentMethodLabels,
  UNSPECIFIED: "Não informado",
} as const;

export type StatementPdfView = "detailed" | "summary";

const defaultFilters: StatementEntryFilters = {
  movementType: "ALL",
  origin: "ALL",
};

const movementTypeLabels: Record<StatementMovementType, string> = {
  ALL: "Todos",
  CANCELLATIONS: "Cancelamentos",
  RECEIPTS: "Recebimentos",
  SALES: "Vendas",
};

const originFilterLabels: Record<StatementOriginFilter, string> = {
  ALL: "Todas",
  CREDIT_MANUAL: "Fiado manual",
  CREDIT_TABLE: "Fiado de mesa",
  TABLE: "Mesa",
};

export function createStatementPdf(
  report: StatementReport,
  view: StatementPdfView = "detailed",
  filters: StatementEntryFilters = defaultFilters,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      bufferPages: true,
      margin: 42,
      size: "A4",
    });
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", reject);

    renderHeader(document, report, view, filters);
    if (view === "summary") {
      renderSummary(document, report);
      renderPaymentMethods(document, report);
      renderOrigins(document, report);
      renderDays(document, report.days);
    } else {
      const filteredEntries = filterStatementEntries(report.entries, filters);
      renderDetailedTotals(document, filteredEntries);
      renderEntries(document, filteredEntries, filters);
    }
    renderPageNumbers(document);
    document.end();
  });
}

function renderHeader(
  document: PDFKit.PDFDocument,
  report: StatementReport,
  view: StatementPdfView,
  filters: StatementEntryFilters,
) {
  document
    .fillColor(colors.accent)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("DESTINY BISTRO CRM");
  document
    .fillColor(colors.text)
    .fontSize(24)
    .text(
      view === "summary" ? "Extrato resumido" : "Extrato detalhado",
      { lineGap: 4 },
    );
  document
    .fillColor(colors.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(
      `Período: ${formatDateKey(report.period.from)} a ${formatDateKey(report.period.to)}`,
    )
    .text(`Fuso: ${report.period.timeZone}`)
    .text(
      view === "detailed"
        ? `Filtros: ${movementTypeLabels[filters.movementType]} · ${originFilterLabels[filters.origin]}`
        : "",
    )
    .text(
      `Gerado em: ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: report.period.timeZone,
      }).format(new Date())}`,
    )
    .moveDown(1.2);
}

function renderSummary(document: PDFKit.PDFDocument, report: StatementReport) {
  sectionTitle(document, "Resumo do período");

  const rows = [
    ["Valor vendido", formatCents(report.summary.soldCents)],
    ["Valor recebido", formatCents(report.summary.receivedCents)],
    ["Itens vendidos", String(report.summary.soldItemCount)],
    ["Itens recebidos", String(report.summary.receivedItemCount)],
    ["Comandas processadas", String(report.summary.processedCommandCount)],
    ["Comandas fechadas", String(report.summary.closedCommandCount)],
    ["Comandas canceladas", String(report.summary.cancelledCommandCount)],
    ["Comandas com venda", String(report.indicators.saleCommandCount)],
    ["Diferença do período", formatCents(report.indicators.differenceCents)],
    ["Ticket médio", formatCents(report.indicators.averageTicketCents)],
  ];

  for (const [label, value] of rows) {
    ensureSpace(document, 22);
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(label, 46, document.y, { continued: true, width: 330 })
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .text(value, { align: "right", width: 165 });
    divider(document);
  }

  document.moveDown(1.2);
}

function renderPaymentMethods(
  document: PDFKit.PDFDocument,
  report: StatementReport,
) {
  sectionTitle(document, "Recebimentos por forma de pagamento");
  for (const payment of report.indicators.paymentMethodSummaries) {
    ensureSpace(document, 22);
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(paymentSummaryLabels[payment.method], 46, document.y, {
        continued: true,
        width: 330,
      })
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .text(formatCents(payment.receivedCents), {
        align: "right",
        width: 165,
      });
    divider(document);
  }
  document.moveDown(1.2);
}

function renderOrigins(document: PDFKit.PDFDocument, report: StatementReport) {
  sectionTitle(document, "Totais por origem");
  for (const origin of report.indicators.originSummaries) {
    ensureSpace(document, 46);
    document
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(originLabels[origin.origin]);
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Vendido ${formatCents(origin.soldCents)} · Recebido ${formatCents(origin.receivedCents)} · ` +
          `${origin.movementCount} movimentações`,
      );
    divider(document);
  }
  document.moveDown(1.2);
}

function renderDetailedTotals(
  document: PDFKit.PDFDocument,
  entries: StatementEntry[],
) {
  const soldCents = entries.reduce((total, entry) => total + entry.soldCents, 0);
  const receivedCents = entries.reduce(
    (total, entry) => total + entry.receivedCents,
    0,
  );
  const commandCount = new Set(entries.map((entry) => entry.comandaId)).size;
  sectionTitle(document, "Totais das etapas exibidas");
  document
    .fillColor(colors.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(
      `Vendas ${formatCents(soldCents)} · ` +
        `Recebimentos ${formatCents(receivedCents)} · ` +
        `${entries.length} etapas em ${commandCount} comandas`,
    )
    .moveDown(1.2);
}

function renderDays(document: PDFKit.PDFDocument, days: StatementDay[]) {
  sectionTitle(document, "Detalhamento diário");

  for (const day of days) {
    ensureSpace(document, 54);
    document
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(formatDateKey(day.date));
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Vendido ${formatCents(day.soldCents)} · Recebido ${formatCents(day.receivedCents)} · ` +
          `Itens ${day.soldItemCount}/${day.receivedItemCount} · ` +
          `Comandas ${day.processedCommandCount} (${day.closedCommandCount} fechadas, ${day.cancelledCommandCount} canceladas)`,
        { lineGap: 2 },
      );
    divider(document);
  }

  document.moveDown(1.2);
}

function renderEntries(
  document: PDFKit.PDFDocument,
  entries: StatementEntry[],
  filters: StatementEntryFilters,
) {
  sectionTitle(document, "Linha do tempo por comanda");

  if (entries.length === 0) {
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(
        filters.movementType === "ALL" && filters.origin === "ALL"
          ? "Nenhuma movimentação encontrada no período."
          : "Nenhuma movimentação encontrada para os filtros selecionados.",
      );
    return;
  }

  for (const group of groupEntriesByCommand(entries)) {
    const firstEntry = group[0];
    ensureSpace(document, 84);
    document
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(commandIdentification(firstEntry));
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `${commandLocation(firstEntry)} · ${originLabels[firstEntry.origin]} · ` +
          `${statusLabels[firstEntry.status]}`,
      );

    for (const [index, entry] of group.entries()) {
      const presentation = entryPresentation(entry);
      ensureSpace(document, 64);
      document
        .fillColor(colors.text)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(
          `Etapa ${index + 1} · ${formatDateTime(entry.occurredAt)} · ${presentation.title}`,
          { indent: 10 },
        )
        .fillColor(colors.muted)
        .font("Helvetica")
        .fontSize(9);
      for (const row of presentation.rows) {
        document.text(`${row.label}: ${formatCents(row.valueCents)}`, {
          indent: 10,
        });
      }
      if (presentation.note) {
        document.text(presentation.note, { indent: 10 });
      }
      if (entry.receivedCents > 0) {
        document.text(
          entry.payments.length === 0
            ? "Pagamento: forma não informada"
            : `Pagamento: ${entry.payments
                .map(
                  (payment) =>
                    `${paymentMethodLabels[payment.method]} ${formatCents(payment.amountCents)}`,
                )
                .join(" · ")}`,
          { indent: 10 },
        );
      }
      for (const item of entry.items) {
        ensureSpace(document, 18);
        document.text(
          `${item.quantity}× ${item.productName} · ${formatCents(item.unitPriceCents)} · ` +
            `Subtotal ${formatCents(item.quantity * item.unitPriceCents)}`,
          { indent: 20 },
        );
      }
    }
    divider(document);
  }
}

function groupEntriesByCommand(entries: StatementEntry[]) {
  const groups = new Map<string, StatementEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.comandaId) ?? [];
    group.push(entry);
    groups.set(entry.comandaId, group);
  }
  return [...groups.values()];
}

function commandIdentification(entry: StatementEntry) {
  const name = entry.customerName ?? entry.comandaName;
  return name
    ? `Comanda #${entry.comandaNumber} · ${name}`
    : `Comanda #${entry.comandaNumber}`;
}

function commandLocation(entry: StatementEntry) {
  if (entry.tableNumber !== null) {
    return `Mesa ${entry.tableNumber}`;
  }
  return entry.customerName ? `Cliente ${entry.customerName}` : "Sem mesa";
}

function entryPresentation(entry: StatementEntry): {
  note?: string;
  rows: { label: string; valueCents: number }[];
  title: string;
} {
  const total = entry.creditTotalCents ?? entry.soldCents;
  const open = entry.creditBalanceAfterCents ?? 0;
  const paid = entry.creditPaidAfterCents ?? entry.receivedCents;

  if (entry.event === "COMANDA_CANCELLED") {
    return {
      note: "Sem impacto nas vendas e recebimentos.",
      rows: [],
      title: "Comanda cancelada",
    };
  }
  if (entry.event === "TABLE_CLOSED") {
    return {
      rows: [
        { label: "Total", valueCents: entry.soldCents },
        { label: "Valor pago", valueCents: entry.receivedCents },
      ],
      title: "Comanda paga",
    };
  }
  if (
    entry.event === "CREDIT_FINALIZED" &&
    entry.origin === "CREDIT_TABLE" &&
    (entry.tableCheckoutPaidCents ?? 0) > 0
  ) {
    return {
      rows: [
        { label: "Valor pago", valueCents: entry.tableCheckoutPaidCents ?? 0 },
        { label: "Valor fiado", valueCents: open },
      ],
      title: "Comanda paga parcialmente",
    };
  }
  if (
    entry.event === "CREDIT_FINALIZED" ||
    entry.paymentOrigin === "TABLE_CHECKOUT"
  ) {
    return {
      rows: [
        { label: "Total", valueCents: total },
        { label: "Valor aberto", valueCents: open },
        { label: "Valor já pago", valueCents: paid },
      ],
      title: "Fiado aberto",
    };
  }
  if (entry.event === "CREDIT_SETTLED") {
    return {
      rows: [
        { label: "Total", valueCents: total },
        { label: "Pago do fiado", valueCents: entry.receivedCents },
        {
          label:
            entry.origin === "CREDIT_TABLE"
              ? "Valor pago na comanda anterior"
              : "Valor pago anteriormente",
          valueCents:
            entry.origin === "CREDIT_TABLE"
              ? (entry.tableCheckoutPaidCents ?? 0)
              : (entry.creditPaidBeforeCents ?? 0),
        },
      ],
      title: "Fiado fechado",
    };
  }
  return {
    rows: [
      { label: "Total", valueCents: total },
      { label: "Valor aberto", valueCents: open },
      { label: "Valor já pago", valueCents: paid },
    ],
    title:
      entry.event === "CREDIT_ADDITION"
        ? "Novo valor adicionado ao fiado"
        : "Fiado pago parcialmente",
  };
}

function sectionTitle(document: PDFKit.PDFDocument, title: string) {
  ensureSpace(document, 32);
  document
    .fillColor(colors.accent)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(title)
    .moveDown(0.5);
}

function divider(document: PDFKit.PDFDocument) {
  const y = document.y + 5;
  document
    .strokeColor(colors.border)
    .lineWidth(0.6)
    .moveTo(42, y)
    .lineTo(document.page.width - 42, y)
    .stroke()
    .moveDown(0.9);
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  if (document.y + height > document.page.height - 72) {
    document.addPage();
  }
}

function renderPageNumbers(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Destiny Bistro CRM · Página ${index + 1} de ${range.count}`,
        42,
        document.page.height - 60,
        {
          align: "center",
          lineBreak: false,
          width: document.page.width - 84,
        },
      );
  }
}

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);
}

function formatDateKey(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
