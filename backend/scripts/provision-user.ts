import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  AuthInputError,
  EstablishmentNotFoundError,
  UserProvisionConflictError,
} from "../src/auth-types.js";
import { createPrismaClient } from "../src/database.js";
import { provisionUser } from "../src/user-provisioning.js";

const terminal = createInterface({ input: stdin, output: stdout });
const prisma = createPrismaClient();

try {
  const establishmentName = await terminal.question("Nome do estabelecimento: ");
  const name = await terminal.question("Nome do usuario: ");
  const rolesInput = await terminal.question(
    "Cargos separados por virgula (OWNER, MANAGER, WAITER, KITCHEN): ",
  );
  const password = process.env.USER_PROVISION_PASSWORD;

  if (!password) {
    throw new Error(
      "Defina USER_PROVISION_PASSWORD apenas nesta sessao do terminal.",
    );
  }

  const user = await provisionUser(prisma, {
    establishmentName,
    name,
    password,
    roleCodes: rolesInput.split(","),
  });

  stdout.write(
    `Usuario ${user.name} criado em ${user.establishment.name} com os cargos ${user.roles
      .map(({ role }) => role.name)
      .join(", ")}.\n`,
  );
} catch (error) {
  if (error instanceof AuthInputError) {
    throw new Error("Nome, senha ou cargo invalido.", { cause: error });
  }

  if (error instanceof UserProvisionConflictError) {
    throw new Error("Ja existe um usuario com esse nome.", { cause: error });
  }

  if (error instanceof EstablishmentNotFoundError) {
    throw new Error("Estabelecimento nao encontrado.", { cause: error });
  }

  throw error;
} finally {
  terminal.close();
  await prisma.$disconnect();
}
