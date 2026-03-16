import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import type { RedisClient } from "bun";
import type { ResolvedConfig } from "../config";
import type { UserStoreAdapter } from "../adapters/user-store/base";
import { verifyPassword } from "../security";
import { setRefreshToken } from "../redis";
import { UnauthorizedError } from "../errors";

const cookieOptions = {
  httpOnly: true,
};

export function createLoginRoute(
  redis: RedisClient,
  userStore: UserStoreAdapter,
  config: ResolvedConfig,
) {
  return new Elysia()
    .use(
      jwt({
        name: "jwt",
        secret: config.jwt.secret,
      }),
    )
    .post(
      "/login",
      async ({ jwt, cookie, body }) => {
        const user = await userStore.findByUsername(body.username);
        if (!user) throw new UnauthorizedError();

        const isValidPassword = await verifyPassword(
          body.password,
          user.password,
        );
        if (!isValidPassword) throw new UnauthorizedError();

        const jti = crypto.randomUUID();
        const accessToken = await jwt.sign({
          id: user.id,
          username: user.username,
          role: user.role,
          emailVerified: user.emailVerified,
          jti,
        });
        const refreshToken = crypto.randomUUID();
        await setRefreshToken(
          redis,
          refreshToken,
          user.id,
          config.tokens.refreshTtl,
        );
        cookie.access_token?.set({
          ...cookieOptions,
          value: accessToken,
          maxAge: config.tokens.accessTokenTtl,
        });
        cookie.refresh_token?.set({
          ...cookieOptions,
          value: refreshToken,
          maxAge: config.tokens.refreshTtl,
          path: `${config.prefix}/refresh`,
        });
        const { password, ...userSafe } = user;

        return { user: userSafe };
      },
      {
        body: t.Object({
          username: t.String(),
          password: t.String(),
        }),
      },
    );
}
