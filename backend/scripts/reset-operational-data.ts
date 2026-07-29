import "dotenv/config";
import { stdout } from "node:process";
import { createPrismaClient } from "../src/database.js";
import { normalizeEstablishmentName } from "../src/establishment-provisioning.js";
import { resetOperationalData } from "../src/operational-data-reset.js";

if (process.env.RESET_OPERATIONAL_DATA !== "CONFIRMAR") {
  throw new Error(
    "Defina RESET_OPERATIONAL_DATA=CONFIRMAR somente para a execução da limpeza.",
  );
}

const prisma = createPrismaClient();

try {
  const establishmentName =
    process.env.RESET_OPERATIONAL_ESTABLISHMENT?.trim();

  if (!establishmentName) {
    throw new Error(
      "Defina RESET_OPERATIONAL_ESTABLISHMENT com o nome exato do estabelecimento.",
    );
  }

  const establishment = await prisma.establishment.findUnique({
    select: { id: true, name: true },
    where: {
      normalizedName:
        normalizeEstablishmentName(establishmentName).normalizedName,
    },
  });

  if (!establishment) {
    throw new Error("Estabelecimento não encontrado.");
  }

  const removed = await resetOperationalData(prisma, establishment.id);
  stdout.write(
    `Limpeza concluída em "${establishment.name}": ${JSON.stringify(removed)}. Estoque, produtos, mesas e usuários foram preservados.\n`,
  );
} finally {
  await prisma.$disconnect();
}
