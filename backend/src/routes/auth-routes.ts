import type { FastifyInstance } from "fastify";
import {
  AuthCredentialsError,
  AuthInputError,
  type AuthRepository,
} from "../auth-repository.js";
import {
  requireAuthToken,
  requireAuthUser,
} from "../authentication.js";

interface LoginBody {
  name?: unknown;
  password?: unknown;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthRepository,
) {
  app.post<{ Body: LoginBody }>(
    "/auth/login",
    {
      config: { authPublic: true },
    },
    async (request, reply) => {
      if (
        !request.body ||
        typeof request.body.name !== "string" ||
        typeof request.body.password !== "string"
      ) {
        return invalidCredentials(reply);
      }

      try {
        return {
          session: await auth.login(
            request.body.name,
            request.body.password,
          ),
        };
      } catch (error) {
        if (
          error instanceof AuthCredentialsError ||
          error instanceof AuthInputError
        ) {
          return invalidCredentials(reply);
        }

        app.log.error(error, "Authentication failed");
        return reply.code(503).send({
          message: "Authentication unavailable",
          status: "error",
        });
      }
    },
  );

  app.get("/auth/me", (request) => ({
    user: requireAuthUser(request),
  }));

  app.post("/auth/logout", async (request, reply) => {
    await auth.logout(requireAuthToken(request));
    return reply.code(204).send();
  });
}

function invalidCredentials(reply: {
  code(statusCode: number): {
    send(payload: { message: string; status: string }): unknown;
  };
}) {
  return reply.code(401).send({
    message: "Invalid name or password",
    status: "error",
  });
}
