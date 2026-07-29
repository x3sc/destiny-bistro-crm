import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  AuthInputError,
  EstablishmentProvisionConflictError,
} from "../src/auth-types.js";
import { createPrismaClient } from "../src/database.js";
import { provisionEstablishment } from "../src/establishment-provisioning.js";

const terminal = createInterface({ input: stdin, output: stdout });
const prisma = createPrismaClient();

try {
  const name = await terminal.question("Nome do estabelecimento: ");
  const ownerName = await terminal.question("Nome do primeiro owner: ");
  const ownerPassword = process.env.USER_PROVISION_PASSWORD;

  if (!ownerPassword) {
    throw new Error(
      "Defina USER_PROVISION_PASSWORD apenas nesta sessao do terminal.",
    );
  }

  const establishment = await provisionEstablishment(prisma, {
    name,
    ownerName,
    ownerPassword,
  });

  stdout.write(
    `Estabelecimento ${establishment.name} criado com o owner ${establishment.users[0]?.name}.\n`,
  );
} catch (error) {
  if (error instanceof AuthInputError) {
    throw new Error("Nome do estabelecimento, owner ou senha invalido.", {
      cause: error,
    });
  }

  if (error instanceof EstablishmentProvisionConflictError) {
    throw new Error("Estabelecimento ou usuario ja cadastrado.", {
      cause: error,
    });
  }

  throw error;
} finally {
  terminal.close();
  await prisma.$disconnect();
}
