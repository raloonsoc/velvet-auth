import Elysia from "elysia";
import { jwt } from "@elysiajs/jwt";
import { isBlacklisted } from "../redis";
import { UnauthorizedError } from "../errors";
import type { ResolvedConfig } from "../config";
import type { TokenPayload, AuthContext } from "../types";
import type { RedisClient } from "bun";

/**
 * Elysia plugin that protects routes by verifying the access token cookie.
 * Injects the authenticated user into ctx.user on success.
 * Throws UnauthorizedError if the token is missing, invalid, or blacklisted.
 */
export function createAuthGuard(redis: RedisClient, config: ResolvedConfig) {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: config.jwt.secret,
      }),
    )
    .derive(
      { as: "global" },
      async ({ jwt, cookie }): Promise<{ user: AuthContext }> => {
        const token = cookie.access_token?.value;
        if (!token) throw new UnauthorizedError();

        const raw = await jwt.verify(token as string);
        if (!raw) throw new UnauthorizedError();
        const payload = raw as unknown as TokenPayload;

        if (await isBlacklisted(redis, payload.jti))
          throw new UnauthorizedError();

        const user: AuthContext = {
          id: payload.id,
          username: payload.username,
          role: payload.role,
          emailVerified: payload.emailVerified,
        };
        return { user };
      },
    );
}
