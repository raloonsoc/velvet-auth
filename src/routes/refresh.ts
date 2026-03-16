import Elysia from "elysia";
import { jwt } from "@elysiajs/jwt";
import type { RedisClient } from "bun";
import type { ResolvedConfig } from "../config";
import { setRefreshToken, getdelRefreshToken } from "../redis";
import { UnauthorizedError } from "../errors";
import type { UserStoreAdapter } from "../adapters/user-store/base";

const cookieOptions = {
  httpOnly: true,
};

export function createRefreshRoute(
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
    .post("/refresh", async ({ jwt, cookie }) => {
      const existsRefreshToken = cookie.refresh_token?.value;
      if (!existsRefreshToken) throw new UnauthorizedError();

      const userId = await getdelRefreshToken(
        redis,
        existsRefreshToken as string,
      );
      if (!userId) throw new UnauthorizedError();

      const user = await userStore.findById(userId);
      if (!user) throw new UnauthorizedError();

      const jti = crypto.randomUUID();
      const accessToken = await jwt.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        jti,
      });
      cookie.access_token?.set({
        ...cookieOptions,
        value: accessToken,
        maxAge: config.tokens.accessTokenTtl,
      });

      const refreshToken = crypto.randomUUID();
      await setRefreshToken(
        redis,
        refreshToken,
        user.id,
        config.tokens.refreshTtl,
      );
      cookie.refresh_token?.set({
        ...cookieOptions,
        value: refreshToken,
        maxAge: config.tokens.refreshTtl,
        path: `${config.prefix}/refresh`,
      });

      const { password, ...userSafe } = user;
      return { user: userSafe };
    });
}
