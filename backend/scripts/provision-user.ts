import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  AuthInputError,
  UserProvisionConflictError,
} from "../src/auth-types.js";
import { createPrismaClient } from "../src/database.js";
import { provisionUser } from "../src/user-provisioning.js";

const terminal = createInterface({ input: stdin, output: stdout });
const prisma = createPrismaClient();

try {
  const name = await terminal.question("Nome do usuário: ");
  const rolesInput = await terminal.question(
    "Cargos separados por vírgula (OWNER, MANAGER, WAITER, KITCHEN): ",
  );
  const password = process.env.USER_PROVISION_PASSWORD;

  if (!password) {
    throw new Error(
      "Defina USER_PROVISION_PASSWORD apenas nesta sessão do terminal.",
    );
  }

  const user = await provisionUser(prisma, {
    name,
    password,
    roleCodes: rolesInput.split(","),
  });

  stdout.write(
    `Usuário ${user.name} criado com os cargos ${user.roles
      .map(({ role }) => role.name)
      .join(", ")}.\n`,
  );
} catch (error) {
  if (error instanceof AuthInputError) {
    throw new Error("Nome, senha ou cargo inválido.", { cause: error });
  }

  if (error instanceof UserProvisionConflictError) {
    throw new Error("Já existe um usuário com esse nome.", { cause: error });
  }

  throw error;
} finally {
  terminal.close();
  await prisma.$disconnect();
}
