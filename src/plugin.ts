import Elysia from "elysia";
import type { UserStoreAdapter } from "./adapters/user-store/base";
import type { EmailAdapter } from "./adapters/email/base";
import { resolveConfig, type AuthConfig } from "./config";
import { AppError } from "./errors";
import { createLoginRoute } from "./routes/login";
import { createRegisterRoute } from "./routes/register";
import { createLogoutRoute } from "./routes/logout";
import { createRefreshRoute } from "./routes/refresh";

export function velvetAuth(
  userStore: UserStoreAdapter,
  emailAdapter: EmailAdapter,
  config: AuthConfig,
) {
  const resolved = resolveConfig(config);
  const redis = new Bun.RedisClient(resolved.redis.url);

  return new Elysia({ prefix: resolved.prefix })
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { error: error.code, message: error.message };
      }
    })
    .use(createLoginRoute(redis, userStore, resolved))
    .use(createRegisterRoute(redis, userStore, emailAdapter, resolved))
    .use(createLogoutRoute(redis, resolved))
    .use(createRefreshRoute(redis, userStore, resolved));
}
