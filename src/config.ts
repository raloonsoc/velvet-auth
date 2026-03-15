import { z } from "zod";

export const authConfigSchema = z.object({
  jwt: z.object({
    secret: z
      .string()
      .min(32, "JWT secret requires a minimum of 32 characters"),
    expiresIn: z.string().default("15m"),
  }),
  redis: z.object({
    url: z.string().default("redis://localhost:6379"),
  }),
  tokens: z
    .object({
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
