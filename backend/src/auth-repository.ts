import { createHash, randomBytes } from "node:crypto";
import { createAuditData } from "./audit.js";
import {
  AuthCredentialsError,
  AuthInputError,
  type AuthRepository,
  type AuthSessionResult,
  type AuthUser,
} from "./auth-types.js";
import {
  type Prisma,
  type PrismaClient,
} from "./generated/prisma/client.js";
import { verifyPassword } from "./password.js";

export * from "./auth-types.js";

const authUserSelect = {
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
        select: {
          code: true,
          id: true,
          name: true,
          permissions: {
            select: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type Transaction = Prisma.TransactionClient;

export function normalizeUserName(rawName: string) {
  const name = rawName.trim().replace(/\s+/gu, " ");

  if (name.length < 2 || name.length > 80) {
    throw new AuthInputError();
  }

  return {
    name,
    normalizedName: name.toLocaleLowerCase("pt-BR"),
  };
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new AuthInputError();
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTtlHours() {
  const value = Number(process.env.SESSION_TTL_HOURS ?? 12);
  return Number.isFinite(value) && value >= 1 && value <= 720 ? value : 12;
}

export function createAuthRepository(prisma: PrismaClient): AuthRepository {
  return {
    async authenticate(token) {
      if (!token) {
        return null;
      }

      const session = await prisma.authSession.findFirst({
        select: {
          id: true,
          user: {
            select: authUserSelect,
          },
        },
        where: {
          expiresAt: { gt: new Date() },
          revokedAt: null,
          tokenHash: hashSessionToken(token),
          user: { active: true },
        },
      });

      if (!session) {
        return null;
      }

      await prisma.authSession.update({
        data: { lastSeenAt: new Date() },
        where: { id: session.id },
      });

      return mapAuthUser(session.user);
    },

    async login(rawName, password) {
      const { normalizedName } = normalizeUserName(rawName);
      validatePassword(password);
      const user = await prisma.user.findUnique({
        select: {
          active: true,
          establishmentId: true,
          id: true,
          passwordHash: true,
        },
        where: { normalizedName },
      });
      const validPassword = await verifyPassword(password, user?.passwordHash);

      if (!user?.active || !validPassword) {
        throw new AuthCredentialsError();
      }

      return prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          data: { lastLoginAt: new Date() },
          where: { id: user.id },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "USER_LOGGED_IN",
            establishmentId: user.establishmentId,
            resourceId: user.id,
            resourceType: "USER",
            userId: user.id,
          }),
        });

        return createSession(transaction, user.id);
      });
    },

    async logout(token) {
      const tokenHash = hashSessionToken(token);
      await prisma.$transaction(async (transaction) => {
        const session = await transaction.authSession.findUnique({
          select: {
            id: true,
            user: {
              select: {
                establishmentId: true,
              },
            },
            userId: true,
          },
          where: { tokenHash },
        });

        if (!session) {
          return;
        }

        await transaction.authSession.updateMany({
          data: { revokedAt: new Date() },
          where: { id: session.id, revokedAt: null },
        });
        await transaction.auditLog.create({
          data: createAuditData({
            action: "USER_LOGGED_OUT",
            establishmentId: session.user.establishmentId,
            resourceId: session.userId,
            resourceType: "USER",
            userId: session.userId,
          }),
        });
      });
    },
  };
}

async function createSession(
  transaction: Transaction,
  userId: string,
): Promise<AuthSessionResult> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + sessionTtlHours() * 60 * 60 * 1_000,
  );
  const user = await transaction.user.findUniqueOrThrow({
    select: authUserSelect,
    where: { id: userId },
  });

  await transaction.authSession.create({
    data: {
      expiresAt,
      tokenHash: hashSessionToken(token),
      userId,
    },
  });

  return {
    expiresAt: expiresAt.toISOString(),
    token,
    user: mapAuthUser(user),
  };
}

function mapAuthUser(
  user: Prisma.UserGetPayload<{ select: typeof authUserSelect }>,
): AuthUser {
  return {
    establishment: user.establishment,
    id: user.id,
    name: user.name,
    permissions: [
      ...new Set(
        user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ].sort(),
    roles: user.roles.map(({ role }) => ({
      code: role.code,
      id: role.id,
      name: role.name,
    })),
  };
}
