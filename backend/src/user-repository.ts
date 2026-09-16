import { normalizeUserName, validatePassword } from "./auth-repository.js";
import { AuthInputError, UserProvisionConflictError } from "./auth-types.js";
import { createAuditData } from "./audit.js";
import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import { hashPassword } from "./password.js";
import {
  canManageUsers, userRoleCodes, UserAccessError,
  type AdminUser, type UserRepository,
} from "./user-types.js";

const userSelect = {
  id: true, name: true, active: true,
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

function mapUser(user: Prisma.UserGetPayload<{ select: typeof userSelect }>): AdminUser {
  return { id: user.id, name: user.name, active: user.active, roles: user.roles.map(({ role }) => role) };
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async list(actor) {
      if (!canManageUsers(actor)) throw new UserAccessError();
      const [users, roles] = await Promise.all([
        prisma.user.findMany({
          where: { establishmentId: actor.establishment.id },
          select: userSelect, orderBy: [{ name: "asc" }, { id: "asc" }],
        }),
        prisma.role.findMany({
          where: { code: { in: [...userRoleCodes] }, system: true },
          select: { id: true, code: true, name: true },
        }),
      ]);
      return {
        users: users.map(mapUser),
        roles: userRoleCodes.flatMap((code) => roles.filter((role) => role.code === code)),
      };
    },
    async create(actor, input) {
      if (!canManageUsers(actor)) throw new UserAccessError();
      const { name, normalizedName } = normalizeUserName(input.name);
      validatePassword(input.password);
      if (!userRoleCodes.includes(input.roleCode)) throw new AuthInputError();
      const role = await prisma.role.findFirst({
        where: { code: input.roleCode, system: true }, select: { id: true },
      });
      if (!role) throw new AuthInputError();
      const passwordHash = await hashPassword(input.password);
      try {
        return await prisma.$transaction(async (transaction) => {
          const user = await transaction.user.create({
            data: {
              name, normalizedName, passwordHash,
              establishmentId: actor.establishment.id,
              roles: { create: { roleId: role.id, assignedByUserId: actor.id } },
            },
            select: userSelect,
          });
          await transaction.auditLog.create({
            data: createAuditData({
              action: "USER_CREATED", establishmentId: actor.establishment.id,
              resourceId: user.id, resourceType: "USER", userId: actor.id,
              metadata: { roleCode: input.roleCode },
            }),
          });
          return mapUser(user);
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          throw new UserProvisionConflictError();
        }
        throw error;
      }
    },
  };
}
