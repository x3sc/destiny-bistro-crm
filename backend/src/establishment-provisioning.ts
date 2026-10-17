import { ensureSystemAccessControl } from "./access-control.js";
import {
  normalizeUserName,
  validatePassword,
} from "./auth-repository.js";
import {
  AuthInputError,
  EstablishmentProvisionConflictError,
} from "./auth-types.js";
import { seedEstablishmentData } from "./establishment-data.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { hashPassword } from "./password.js";
import { createInitialTenantRoles } from './tenant-role-provisioning.js';

export function normalizeEstablishmentName(rawName: string) {
  const name = rawName.trim().replace(/\s+/gu, " ");

  if (name.length < 2 || name.length > 80) {
    throw new AuthInputError();
  }

  return {
    name,
    normalizedName: name.toLocaleLowerCase("pt-BR"),
  };
}

export async function provisionEstablishment(
  prisma: PrismaClient,
  {
    name: rawName,
    ownerName: rawOwnerName,
    ownerPassword,
  }: {
    name: string;
    ownerName: string;
    ownerPassword: string;
  },
) {
  const { name, normalizedName } = normalizeEstablishmentName(rawName);
  const owner = normalizeUserName(rawOwnerName);
  validatePassword(ownerPassword);

  await ensureSystemAccessControl(prisma);
  const passwordHash = await hashPassword(ownerPassword);

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const base = await transaction.establishment.create({ data: { name, normalizedName }, select: { id: true } });
        await createInitialTenantRoles(transaction, base.id);
        const ownerRole = await transaction.tenantRole.findUniqueOrThrow({ where: { establishmentId_code: { establishmentId: base.id, code: 'OWNER' } } });
        await transaction.user.create({ data: { establishmentId: base.id, localRoleId: ownerRole.id,
          name: owner.name, normalizedName: owner.normalizedName, passwordHash } });
        const establishment = await transaction.establishment.findUniqueOrThrow({
          where: { id: base.id },
          select: {
            id: true,
            name: true,
            users: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        await seedEstablishmentData(transaction, establishment.id);
        return establishment;
      },
      {
        timeout: 30_000,
      },
    );
  } catch (error) {
    if (
      !!error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new EstablishmentProvisionConflictError();
    }

    throw error;
  }
}
