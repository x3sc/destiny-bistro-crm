import { ensureSystemAccessControl } from "./access-control.js";
import {
  normalizeUserName,
  validatePassword,
} from "./auth-repository.js";
import {
  AuthInputError,
  EstablishmentNotFoundError,
  UserProvisionConflictError,
} from "./auth-types.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { hashPassword } from "./password.js";

export async function provisionUser(
  prisma: PrismaClient,
  {
    establishmentName: rawEstablishmentName,
    name: rawName,
    password,
    roleCodes: rawRoleCodes,
  }: {
    establishmentName: string;
    name: string;
    password: string;
    roleCodes: string[];
  },
) {
  const normalizedEstablishmentName = rawEstablishmentName
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("pt-BR");
  const { name, normalizedName } = normalizeUserName(rawName);
  validatePassword(password);
  const roleCodes = [
    ...new Set(rawRoleCodes.map((code) => code.trim().toUpperCase())),
  ].filter(Boolean);

  if (roleCodes.length === 0) {
    throw new AuthInputError();
  }

  await ensureSystemAccessControl(prisma);
  const establishment = await prisma.establishment.findUnique({
    select: { id: true },
    where: { normalizedName: normalizedEstablishmentName },
  });

  if (!establishment) {
    throw new EstablishmentNotFoundError();
  }

  const roles = await prisma.role.findMany({
    select: { id: true },
    where: { code: { in: roleCodes } },
  });

  if (roles.length !== roleCodes.length) {
    throw new AuthInputError();
  }

  const passwordHash = await hashPassword(password);

  try {
    return await prisma.user.create({
      data: {
        establishmentId: establishment.id,
        name,
        normalizedName,
        passwordHash,
        roles: {
          create: roles.map(({ id }) => ({ roleId: id })),
        },
      },
      select: {
        establishment: {
          select: {
            id: true,
            name: true,
          },
        },
        id: true,
        name: true,
        roles: {
          select: {
            role: {
              select: { code: true, name: true },
            },
          },
        },
      },
    });
  } catch (error) {
    if (
      !!error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new UserProvisionConflictError();
    }

    throw error;
  }
}
