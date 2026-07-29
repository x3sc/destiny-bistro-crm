import "dotenv/config";
import { stdout } from "node:process";
import { createPrismaClient } from "../src/database.js";
import { resetOperationalData } from "../src/operational-data-reset.js";

if (process.env.RESET_OPERATIONAL_DATA !== "CONFIRMAR") {
  throw new Error(
    "Defina RESET_OPERATIONAL_DATA=CONFIRMAR somente para a execução da limpeza.",
  );
}

const prisma = createPrismaClient();

try {
  const removed = await resetOperationalData(prisma);
  stdout.write(
    `Limpeza concluída: ${JSON.stringify(removed)}. Produtos, mesas e usuários foram preservados.\n`,
  );
} finally {
  await prisma.$disconnect();
}
