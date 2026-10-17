import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { PermissionCode } from "./access-control.js";
import type { AuthRepository, AuthUser } from "./auth-repository.js";
import { requestAccess } from './comanda-source-access.js';

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
  app.addHook('onRequest', (_request, _reply, done) => requestAccess.run({ actor: null }, done));

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

    const shared = request.routeOptions.url?.startsWith('/comandas/') && (permission === 'comandas.read' || permission === 'comandas.write');
    const allowed = shared ? ['comandas', 'credits', 'deliveries', 'quick-sales', 'counter-sales'].some((module) =>
      user.permissions.includes(`${module}.${permission === 'comandas.write' ? 'write' : 'read'}`)) : !permission || hasAppPermission(user, permission);
    if (!allowed) {
      return reply.code(403).send({
        message: "Permission denied",
        status: "error",
      });
    }

    request.authToken = token;
    request.authUser = user;
    const context = requestAccess.getStore();
    if (!context) throw new Error('Request access context unavailable');
    context.actor = user;
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

export function hasAppPermission(user: AuthUser | null, permission: string): boolean {
  if (!user?.permissions.includes(permission)) return false;
  return true;
}
