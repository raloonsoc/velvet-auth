import Elysia, { t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import type { RedisClient } from "bun";
import type { ResolvedConfig } from "../config";
import type { UserStoreAdapter } from "../adapters/user-store/base";
import type { EmailAdapter } from "../adapters/email/base";
import {
  hashPassword,
  hashVerificationToken,
  generateVerificationToken,
} from "../security";
import { setRefreshToken, setVerificationToken } from "../redis";
import { BadRequestError } from "../errors";

const cookieOptions = {
  httpOnly: true,
};

export function createRegisterRoute(
  redis: RedisClient,
  userStore: UserStoreAdapter,
  emailAdapter: EmailAdapter,
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
      "/register",
      async ({ jwt, cookie, body }) => {
        const username = body.username;
        const email = body.email;

        const existsUsername = await userStore.findByUsername(username);
        if (existsUsername) throw new BadRequestError();

        const existsEmail = await userStore.findByEmail(email);
        if (existsEmail) throw new BadRequestError();

        const hashedPassword = await hashPassword(body.password, config);

        const user = await userStore.create({
          username,
          email,
          password: hashedPassword,
        });

        if (config.routes.emailVerification) {
          const verificationToken = generateVerificationToken();

          const verificationTokenHash =
            hashVerificationToken(verificationToken);

          await setVerificationToken(
            redis,
            user.id,
            verificationTokenHash,
            config.tokens.verificationTtl,
          );

          const verificationUrl = `${config.prefix}/verify-email?token=${verificationToken}&userId=${user.id}`;
          await emailAdapter.sendVerification(user.email, verificationUrl);
        }

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
          email: t.String(),
          password: t.String(),
        }),
      },
    );
}
