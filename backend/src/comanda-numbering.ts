import type { Transaction } from "./comanda-persistence.js";

export const COMANDA_TIME_ZONE = "America/Sao_Paulo";

const comandaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: COMANDA_TIME_ZONE,
  year: "numeric",
});

export type Clock = () => Date;

export function comandaOpenedDate(openedAt: Date) {
  return comandaDateFormatter.format(openedAt);
}

export async function allocateComandaIdentity(
  transaction: Transaction,
  establishmentId: string,
  openedAt: Date,
) {
  const openedDateKey = comandaOpenedDate(openedAt);
  const openedDate = new Date(`${openedDateKey}T00:00:00.000Z`);

  await transaction.$executeRaw`
    INSERT INTO ComandaDailySequence (
      establishmentId,
      openedDate,
      lastNumber,
      updatedAt
    ) VALUES (
      ${establishmentId},
      ${openedDate},
      1,
      CURRENT_TIMESTAMP(3)
    )
    ON DUPLICATE KEY UPDATE
      lastNumber = lastNumber + 1,
      updatedAt = CURRENT_TIMESTAMP(3)
  `;

  const sequence = await transaction.comandaDailySequence.findUniqueOrThrow({
    select: { lastNumber: true },
    where: {
      establishmentId_openedDate: {
        establishmentId,
        openedDate,
      },
    },
  });

  return {
    number: sequence.lastNumber,
    openedAt,
    openedDate,
  };
}
