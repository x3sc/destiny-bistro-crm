import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { PermissionCode } from "./access-control.js";
import type { AuthRepository, AuthUser } from "./auth-repository.js";

declare module "fastify" {
  interface FastifyContextConfig {
    authPublic?: boolean;
    permission?: PermissionCode;
  }

  interface FastifyRequest {
    authToken: string | null;
    authUser: AuthUser | null;
  }
}

export function registerAuthentication(
  app: FastifyInstance,
  auth: AuthRepository,
) {
  app.decorateRequest("authToken", null);
  app.decorateRequest("authUser", null);

  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config.authPublic === true) {
      return;
    }

    const token = readBearerToken(request.headers.authorization);
    const user = token ? await auth.authenticate(token) : null;

    if (!token || !user) {
      return reply.code(401).send({
        message: "Authentication required",
        status: "error",
      });
    }

    const permission = request.routeOptions.config.permission;

    if (permission && !user.permissions.includes(permission)) {
      return reply.code(403).send({
        message: "Permission denied",
        status: "error",
      });
    }

    request.authToken = token;
    request.authUser = user;
  });
}

export function requireAuthUser(request: FastifyRequest) {
  if (!request.authUser) {
    throw new Error("Authenticated user unavailable");
  }

  return request.authUser;
}

export function requireAuthToken(request: FastifyRequest) {
  if (!request.authToken) {
    throw new Error("Authenticated token unavailable");
  }

  return request.authToken;
}

function readBearerToken(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = /^Bearer ([A-Za-z0-9_-]{20,})$/u.exec(value);
  return match?.[1] ?? null;
}

export type AuthorizationReply = FastifyReply;
