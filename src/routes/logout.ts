import Elysia from "elysia";
import { jwt } from "@elysiajs/jwt";
import type { RedisClient } from "bun";
import type { ResolvedConfig } from "../config";
import type { TokenPayload } from "../types";
import { blacklistToken, getdelRefreshToken, isBlacklisted } from "../redis";
import { UnauthorizedError } from "../errors";

export function createLogoutRoute(redis: RedisClient, config: ResolvedConfig) {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: config.jwt.secret,
      }),
    )
    .post("/logout", async ({ jwt, cookie }) => {
      const token = cookie.access_token?.value;
      if (!token) throw new UnauthorizedError();

      const raw = await jwt.verify(token as string);
      if (!raw) throw new UnauthorizedError();

      const payload = raw as unknown as TokenPayload;

      if (await isBlacklisted(redis, payload.jti))
        throw new UnauthorizedError();

      await blacklistToken(redis, payload.jti, config.tokens.accessTokenTtl);

      // Atomically consume the refresh token
      const refreshToken = cookie.refresh_token?.value;
      if (refreshToken) {
        await getdelRefreshToken(redis, refreshToken as string);
      }

      cookie.access_token?.remove();
      cookie.refresh_token?.remove();
      await config.hooks?.onLogout?.(payload);
      return { success: true };
    });
}
