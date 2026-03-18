<p align="center">
  <img src="docs/banner.png?v=v0.1.9" alt="velvet-auth" width="100%" style="max-height:400px;object-fit:cover;" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/velvet-auth"><img src="https://img.shields.io/npm/v/velvet-auth?style=flat-square&color=C41E3A&label=npm" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/velvet-auth"><img src="https://img.shields.io/npm/dm/velvet-auth?style=flat-square&color=C41E3A&label=downloads" alt="downloads" /></a>
  <a href="https://github.com/raloonsoc/velvet-auth/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/raloonsoc/velvet-auth/ci.yml?branch=main&style=flat-square&color=C41E3A&label=CI" alt="CI" /></a>
  <a href="https://github.com/raloonsoc/velvet-auth/blob/main/LICENSE"><img src="https://img.shields.io/github/license/raloonsoc/velvet-auth?style=flat-square&color=C41E3A" alt="license" /></a>
  <img src="https://img.shields.io/badge/bun-%3E%3D1.0-C41E3A?style=flat-square" alt="bun" />
  <img src="https://img.shields.io/badge/elysia-%3E%3D1.0-C41E3A?style=flat-square" alt="elysia" />
</p>

<p align="center">
  Production-ready authentication plugin for <a href="https://elysiajs.com/">Elysia</a> + <a href="https://bun.sh/">Bun</a>.<br/>
  JWT rotation · Argon2id · RESP-compatible sessions · Zero bloat.
</p>

---

## Why velvet-auth?

Every Bun/Elysia project needs the same auth stack: hash passwords securely, issue JWTs, rotate them, invalidate on logout. Setting it up from scratch every time is tedious and error-prone.

velvet-auth packages that stack into a single plugin. You bring your own database and email provider — velvet-auth handles the rest.

---

## Features

- **JWT rotation** — Access + refresh token rotation via `httpOnly` cookies, path-scoped for security
- **Native Argon2id** — Password hashing via `Bun.password`, zero extra native dependencies
- **RESP-compatible sessions** — Refresh tokens + JTI blacklist on logout using atomic `GETDEL`. Works with Redis, Valkey, KeyDB, Dragonfly, and Garnet
- **Adapter pattern** — Plug in any database or email provider with a simple interface
- **Auth guard** — `createAuthGuard()` verifies the token and injects `ctx.user` on protected routes
- **Type-safe config** — Full Zod validation with sane, secure defaults

> **Bun-only.** Relies on `Bun.password` (native Argon2id) and `Bun.RedisClient`. No extra native dependencies required.

---

## Requirements

- Bun >= 1.0
- Elysia >= 1.0
- Redis >= 6 or any RESP-compatible server (Valkey, KeyDB, Dragonfly, Garnet)

---

## Installation

```sh
bun add velvet-auth
```

---

## Quick start

```typescript
import { Elysia } from "elysia";
import { velvetAuth } from "velvet-auth";

// 1. Implement the UserStoreAdapter for your database
const userStore = {
  findById:       async (id) => db.users.findOne({ id }),
  findByUsername: async (username) => db.users.findOne({ username }),
  findByEmail:    async (email) => db.users.findOne({ email }),
  create:         async (data) => db.users.insert(data),
  updatePassword: async (id, hash) => db.users.update({ id }, { password: hash }),
  setEmailVerified: async (id) => db.users.update({ id }, { emailVerified: true }),
};

// 2. Implement the EmailAdapter for your email provider
const emailAdapter = {
  sendOtp:          async (to, otp) => mailer.send({ to, subject: "Your OTP", text: otp }),
  sendVerification: async (to, url) => mailer.send({ to, subject: "Verify your email", text: url }),
  checkStatus:      async () => true,
};

// 3. Mount the plugin
const app = new Elysia()
  .use(
    velvetAuth(userStore, emailAdapter, {
      jwt: {
        secret: process.env.JWT_SECRET!, // min 32 chars
      },
    }),
  )
  .listen(3000);
```

That's it. The following routes are now available:

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login, set httpOnly cookies |
| `POST` | `/auth/logout` | Logout + invalidate tokens |
| `POST` | `/auth/refresh` | Rotate access + refresh tokens |

---

## Protecting routes

Use `createAuthGuard()` to protect any route. It verifies the access token cookie, checks the JTI blacklist, and injects `ctx.user`.

```typescript
import { Elysia } from "elysia";
import { velvetAuth, createAuthGuard } from "velvet-auth";

// Pass the same client to both velvetAuth and createAuthGuard to avoid opening two connections
const redis = new Bun.RedisClient(process.env.REDIS_URL!);
const config = { jwt: { secret: process.env.JWT_SECRET! }, redis: { client: redis } };

const authGuard = createAuthGuard(redis, config);

const app = new Elysia()
  .use(velvetAuth(userStore, emailAdapter, config))
  .use(authGuard)
  .get("/me", ({ user }) => user)         // { id, username, role, emailVerified }
  .get("/dashboard", ({ user }) => {
    return `Welcome, ${user.username}`;
  })
  .listen(3000);
```

---

## Configuration

All options with their defaults:

```typescript
velvetAuth(userStore, emailAdapter, {
  // Required
  jwt: {
    secret: string,        // min 32 chars
    expiresIn: "15m",
  },

  // Optional
  redis: {
    url: "redis://localhost:6379",  // used to create an internal client
    // client: myRedisClient,       // pass an existing Bun.RedisClient to reuse it
  },
  tokens: {
    accessTokenTtl: 900,   // 15 min (seconds)
    refreshTtl: 604800,    // 7 days  (seconds)
    verificationTtl: 86400,// 24h     (seconds)
    otpTtl: 900,           // 15 min  (seconds)
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

---

## Adapters

### UserStoreAdapter

Implement this interface to connect velvet-auth to any database:

```typescript
import type { UserStoreAdapter } from "velvet-auth";

const userStore: UserStoreAdapter = {
  findById:         async (id: string) => { /* return user or null */ },
  findByUsername:   async (username: string) => { /* return user or null */ },
  findByEmail:      async (email: string) => { /* return user or null */ },
  create:           async (data) => { /* persist and return created user */ },
  updatePassword:   async (id, hash) => { /* update password hash */ },
  setEmailVerified: async (id) => { /* mark email as verified */ },
};
```

> The `password` field passed to `create()` is already hashed by velvet-auth — store it as-is.

### EmailAdapter

Implement this interface to connect any email provider (Resend, Nodemailer, etc.):

```typescript
import type { EmailAdapter } from "velvet-auth";

const emailAdapter: EmailAdapter = {
  sendOtp:          async (to: string, otp: string) => { /* send OTP email */ },
  sendVerification: async (to: string, url: string) => { /* send verification link */ },
  checkStatus:      async () => true, /* return false if provider is unreachable */
};
```

---

## Types

```typescript
// Minimum shape required from a user record
interface AuthUser {
  id: string;
  username: string;
  email: string;
  password: string;       // Argon2id hash
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

---

## Security design

| Concern | Approach |
|---------|----------|
| Password hashing | Argon2id via `Bun.password` — native, no extra deps |
| Email verification | SHA-256 of a random 32-byte token, stored in Redis |
| Refresh tokens | UUID stored in Redis, consumed atomically with `GETDEL` |
| JWT revocation | JTI blacklist in Redis on logout, TTL = `accessTokenTtl` |
| Cookies | `httpOnly`, refresh token path-scoped to `/auth/refresh` |
| Anti-enumeration | `register` returns a generic error for duplicate username/email |

---

## Error responses

All errors follow the same shape:

```json
{
  "error": "UNAUTHORIZED",
  "message": "Unauthorized"
}
```

| Code | Status |
|------|--------|
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `BAD_REQUEST` | 400 |
| `INTERNAL_SERVER_ERROR` | 500 |

---

## Roadmap

- **v0.1** — Core: register, login, logout, refresh, auth guard ✓
- **v0.2** — Email flows: forgot/reset password, email verification
- **v0.3** — RBAC: `verifiedGuard`, `requiredRole`, Drizzle adapter

---

## License

MIT

---

If velvet-auth saves you time, a ⭐ on GitHub goes a long way.
