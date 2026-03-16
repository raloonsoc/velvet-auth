# velvet-auth

Production-ready authentication plugin for [Elysia](https://elysiajs.com/) + [Bun](https://bun.sh/).

> **Bun-only.** Uses `Bun.password` (native Argon2id) and `Bun.Redis` (native Redis client). No extra native dependencies required.

---

## Features

- **JWT authentication** — access + refresh token rotation via httpOnly cookies
- **Argon2id password hashing** — via Bun's native `Bun.password` API, zero extra deps
- **Redis-backed sessions** — refresh tokens, JWT blacklist on logout
- **Email verification** — SHA-256 tokenized flow (optional)
- **Auth guard** — `createAuthGuard()` injects `ctx.user` on protected routes
- **Adapter pattern** — bring your own email provider and user store
- **Zod validation** — all config type-safe with sane defaults

## Requirements

- Bun >= 1.0
- Elysia >= 1.0
- Redis instance

## Installation

```sh
bun add velvet-auth
```

## Quick start

```typescript
import { Elysia } from "elysia";
import { velvetAuth } from "velvet-auth";

const app = new Elysia()
  .use(
    velvetAuth(myUserStore, myEmailAdapter, {
      jwt: {
        secret: process.env.JWT_SECRET!, // min 32 chars
      },
    }),
  )
  .listen(3000);
```

This mounts the following routes under `/auth` automatically:

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/logout` | Logout + invalidate tokens |
| `POST` | `/auth/refresh` | Rotate access + refresh tokens |

## Guards

```typescript
import { createAuthGuard } from "velvet-auth";

const authGuard = createAuthGuard(redis, config);

// Requires valid JWT → injects ctx.user
app.use(authGuard).get("/me", ({ user }) => user);
```

## Configuration

All options with their defaults:

```typescript
velvetAuth(userStore, emailAdapter, {
  // Required
  jwt: {
    secret: string,               // min 32 chars
    expiresIn: "15m",
  },

  // Optional — defaults shown
  redis: {
    url: "redis://localhost:6379",
  },
  tokens: {
    accessTokenTtl: 900,          // 15 min
    refreshTtl: 604800,           // 7 days
    verificationTtl: 86400,       // 24h
    otpTtl: 900,                  // 15 min
  },
  argon2: {
    memoryCost: 65536,
    timeCost: 3,
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
  },
  prefix: "/auth",
  routes: {
    forgotPassword: true,
    emailVerification: true,
  },
});
```

## Custom adapters

### User store adapter

```typescript
import type { UserStoreAdapter } from "velvet-auth";

const myUserStore: UserStoreAdapter = {
  findById: async (id) => { /* ... */ },
  findByUsername: async (username) => { /* ... */ },
  findByEmail: async (email) => { /* ... */ },
  create: async (data) => { /* ... */ },
  updatePassword: async (id, hash) => { /* ... */ },
  setEmailVerified: async (id) => { /* ... */ },
};
```

### Email adapter

```typescript
import type { EmailAdapter } from "velvet-auth";

const myEmailAdapter: EmailAdapter = {
  sendOtp: async (to, otp) => { /* ... */ },
  sendVerification: async (to, url) => { /* ... */ },
  checkStatus: async () => true,
};
```

## Types

```typescript
// Minimum shape required from a user record
interface AuthUser {
  id: string;
  username: string;
  email: string;
  password: string;      // Argon2id hash
  role: string;
  emailVerified: boolean;
}

// Injected into ctx.user by createAuthGuard
interface AuthContext {
  id: string;
  username: string;
  role: string;
  emailVerified: boolean;
}
```

## Security design

| Concern | Approach |
|---------|----------|
| Password hashing | Argon2id via `Bun.password` (native, no deps) |
| Email verification | SHA-256 of a random 32-byte token, stored in Redis |
| Refresh tokens | UUID stored in Redis, consumed atomically with `GETDEL` |
| JWT revocation | JTI blacklist in Redis on logout, TTL = `accessTokenTtl` |
| Cookies | `httpOnly`, refresh token path-scoped to `/auth/refresh` |
| Anti-enumeration | `register` returns generic error for duplicate username/email |

## Error responses

All errors follow a consistent shape:

```json
{
  "error": "UNAUTHORIZED",
  "message": "Unauthorized"
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`.

## Roadmap

- **v0.1** — Core: register, login, logout, refresh, auth guard ✓
- **v0.2** — Email flows: forgot/reset password, email verification endpoint
- **v0.3** — RBAC: `verifiedGuard`, `requiredRole`, Drizzle adapter

## License

MIT
