import { z } from "zod";

export const authConfigSchema = z.object({
  jwt: z.object({
    secret: z
      .string()
      .min(32, "JWT secret requires a minimum of 32 characters"),
    expiresIn: z.string().default("15m"),
  }),
  redis: z
    .object({
      url: z.string().default("redis://localhost:6379"),
    })
    .default({ url: "redis://localhost:6379" }),
  tokens: z
    .object({
      accessTokenTtl: z.number().default(900),
      refreshTtl: z.number().default(604800), // 7 days
      verificationTtl: z.number().default(86400), // 24h
      otpTtl: z.number().default(900), // 15 min
    })
    .optional(),
  argon2: z
    .object({
      memoryCost: z.number().default(65536),
      timeCost: z.number().default(3),
    })
    .optional(),
  password: z
    .object({
      minLength: z.number().default(8),
      requireUppercase: z.boolean().default(true),
      requireNumber: z.boolean().default(true),
      requireSpecial: z.boolean().default(true),
    })
    .optional(),
  rateLimit: z
    .object({
      auth: z
        .object({
          max: z.number().default(10),
          window: z.number().default(60),
        })
        .optional(),
    })
    .optional(),
  prefix: z.string().default("/auth"),
  routes: z
    .object({
      forgotPassword: z.boolean().default(true),
      emailVerification: z.boolean().default(true),
    })
    .optional(),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;

const DEFAULTS = {
  tokens: {
    accessTokenTtl: 900,
    refreshTtl: 604800,
    verificationTtl: 86400,
    otpTtl: 900,
  },
  argon2: { memoryCost: 65536, timeCost: 3 },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
  },
  rateLimit: { auth: { max: 10, window: 60 } },
  routes: { forgotPassword: true, emailVerification: true },
};

export function resolveConfig(input: unknown) {
  const parsed = authConfigSchema.parse(input);
  return {
    ...parsed,
    tokens: { ...DEFAULTS.tokens, ...parsed.tokens },
    argon2: { ...DEFAULTS.argon2, ...parsed.argon2 },
    password: { ...DEFAULTS.password, ...parsed.password },
    rateLimit: {
      auth: { ...DEFAULTS.rateLimit.auth, ...parsed.rateLimit?.auth },
    },
    routes: { ...DEFAULTS.routes, ...parsed.routes },
  };
}

export type ResolvedConfig = ReturnType<typeof resolveConfig>;
