import PDFDocument from "pdfkit";
import type {
  StatementDay,
  StatementEntry,
  StatementReport,
} from "./statement-report.js";

const colors = {
  accent: "#76513d",
  background: "#f7f3ed",
  border: "#d8c5b4",
  muted: "#6c5d54",
  text: "#382b25",
};

const eventLabels: Record<StatementEntry["event"], string> = {
  COMANDA_CANCELLED: "Cancelamento",
  CREDIT_ADDITION: "Acréscimo no fiado",
  CREDIT_FINALIZED: "Fiado finalizado",
  CREDIT_SETTLED: "Fiado quitado",
  TABLE_CLOSED: "Mesa fechada",
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

export function createStatementPdf(report: StatementReport): Promise<Buffer> {
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

    renderHeader(document, report);
    renderSummary(document, report);
    renderDays(document, report.days);
    renderEntries(document, report.entries);
    renderPageNumbers(document);
    document.end();
  });
}

function renderHeader(document: PDFKit.PDFDocument, report: StatementReport) {
  document
    .fillColor(colors.accent)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("DESTINY BISTRO CRM");
  document
    .fillColor(colors.text)
    .fontSize(24)
    .text("Extrato financeiro", { lineGap: 4 });
  document
    .fillColor(colors.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(
      `Período: ${formatDateKey(report.period.from)} a ${formatDateKey(report.period.to)}`,
    )
    .text(`Fuso: ${report.period.timeZone}`)
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
) {
  sectionTitle(document, "Movimentações");

  if (entries.length === 0) {
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(10)
      .text("Nenhuma movimentação encontrada no período.");
    return;
  }

  for (const entry of entries) {
    ensureSpace(document, 70);
    const identification = entry.comandaName
      ? `Comanda #${entry.comandaNumber} · ${entry.comandaName}`
      : `Comanda #${entry.comandaNumber}`;

    document
      .fillColor(colors.text)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(identification);
    document
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `${formatDateTime(entry.occurredAt)} · ${eventLabels[entry.event]} · ` +
          `${originLabels[entry.origin]} · ${statusLabels[entry.status]}`,
      )
      .text(
        `Vendido ${formatCents(entry.soldCents)} (${entry.soldItemCount} itens) · ` +
          `Recebido ${formatCents(entry.receivedCents)} (${entry.receivedItemCount} itens)`,
      );
    divider(document);
  }
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
