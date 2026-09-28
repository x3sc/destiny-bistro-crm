import { createHash } from "node:crypto";

type CancellationDisposition = "RETURN_TO_STOCK" | "LOSS";

interface CancellationOperation {
  comandaId: string | null;
  reason: string | null;
  requestFingerprint: string | null;
  sourceId: string | null;
  type: string;
}

interface ReplayExpectation {
  comandaId: string;
  fingerprint: string;
  reason: string;
  sourceId: string;
}

export function normalizeCancellationReason(reason: string) {
  return reason.trim().replace(/\s+/gu, " ");
}

export function buildComandaCancellationFingerprint(input: {
  actorUserId: string;
  comandaId: string;
  disposition?: CancellationDisposition;
  reason: string;
}) {
  return hashCancellation({
    actorUserId: input.actorUserId,
    comandaId: input.comandaId,
    disposition: input.disposition ?? null,
    kind: "COMANDA_TOTAL",
    reason: input.reason,
  });
}

export function buildItemCancellationFingerprint(input: {
  actorUserId: string;
  comandaId: string;
  configurationId: string;
  disposition: CancellationDisposition;
  itemId: string;
  quantity: number;
  reason: string;
}) {
  return hashCancellation({
    actorUserId: input.actorUserId,
    comandaId: input.comandaId,
    configurationId: input.configurationId,
    disposition: input.disposition,
    itemId: input.itemId,
    kind: "COMANDA_ITEM_CONFIGURATION",
    quantity: input.quantity,
    reason: input.reason,
  });
}

export function isMatchingCancellationReplay(
  operation: CancellationOperation,
  expectation: ReplayExpectation,
) {
  if (
    operation.type !== "CANCELLATION" ||
    operation.comandaId !== expectation.comandaId ||
    operation.sourceId !== expectation.sourceId ||
    operation.reason !== expectation.reason
  ) {
    return false;
  }

  return (
    operation.requestFingerprint === null ||
    operation.requestFingerprint === expectation.fingerprint
  );
}

function hashCancellation(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
