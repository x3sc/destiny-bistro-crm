import type { FastifyInstance, FastifyReply } from "fastify";
import { requireAuthUser } from "../authentication.js";
import { AuthInputError, UserProvisionConflictError } from "../auth-types.js";
import { canManageUsers, userRoleCodes, UserAccessError, type CreateUserInput, type UserRepository } from "../user-types.js";

function isCreateUserInput(body: unknown): body is CreateUserInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return Object.keys(value).length === 3 &&
    typeof value.name === "string" && typeof value.password === "string" &&
    typeof value.roleCode === "string" &&
    userRoleCodes.some((code) => code === value.roleCode);
}

export function registerUserRoutes(app: FastifyInstance, users: UserRepository) {
  const options = { config: { permission: "users.manage" as const } };
  app.get("/admin/users", options, async (request, reply) => {
    const actor = requireAuthUser(request);
    if (!canManageUsers(actor)) return forbidden(reply);
    try { return await users.list(actor); }
    catch (error) { return failed(error, reply, app); }
  });
  app.post<{ Body: unknown }>("/admin/users", options, async (request, reply) => {
    const actor = requireAuthUser(request);
    if (!canManageUsers(actor)) return forbidden(reply);
    if (!isCreateUserInput(request.body)) return invalid(reply);
    try {
      return reply.code(201).send({ user: await users.create(actor, request.body) });
    } catch (error) { return failed(error, reply, app); }
  });
}

function forbidden(reply: FastifyReply) {
  return reply.code(403).send({ status: "error", message: "Permission denied" });
}
function invalid(reply: FastifyReply) {
  return reply.code(400).send({ status: "error", message: "Invalid user data" });
}
function failed(error: unknown, reply: FastifyReply, app: FastifyInstance) {
  if (error instanceof UserAccessError) return forbidden(reply);
  if (error instanceof AuthInputError) return invalid(reply);
  if (error instanceof UserProvisionConflictError) {
    return reply.code(409).send({ status: "error", message: "User name unavailable" });
  }
  // Prisma errors can include creation arguments, including the password hash.
  app.log.error("User administration unavailable");
  return reply.code(503).send({ status: "error", message: "User administration unavailable" });
}
