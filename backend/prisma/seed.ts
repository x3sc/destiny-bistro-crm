import { ensureSystemAccessControl } from "../src/access-control.js";
import { createPrismaClient } from "../src/database.js";
import { seedEstablishmentData } from "../src/establishment-data.js";

const prisma = createPrismaClient();

try {
  await ensureSystemAccessControl(prisma);
  const establishments = await prisma.establishment.findMany({
    select: { id: true },
  });

  for (const establishment of establishments) {
    await prisma.$transaction(
      (transaction) =>
        seedEstablishmentData(transaction, establishment.id),
      {
        timeout: 30_000,
      },
    );
  }
} finally {
  await prisma.$disconnect();
}
