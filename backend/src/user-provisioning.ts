import { ensureSystemAccessControl } from "./access-control.js";
import {
  normalizeUserName,
  validatePassword,
} from "./auth-repository.js";
import {
  AuthInputError,
  UserProvisionConflictError,
} from "./auth-types.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { hashPassword } from "./password.js";

export async function provisionUser(
  prisma: PrismaClient,
  {
    name: rawName,
    password,
    roleCodes: rawRoleCodes,
  }: {
    name: string;
    password: string;
    roleCodes: string[];
  },
) {
  const { name, normalizedName } = normalizeUserName(rawName);
  validatePassword(password);
  const roleCodes = [
    ...new Set(rawRoleCodes.map((code) => code.trim().toUpperCase())),
  ].filter(Boolean);

  if (roleCodes.length === 0) {
    throw new AuthInputError();
  }

  await ensureSystemAccessControl(prisma);
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
        name,
        normalizedName,
        passwordHash,
        roles: {
          create: roles.map(({ id }) => ({ roleId: id })),
        },
      },
      select: {
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
