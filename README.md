# velvet-auth

Production-ready authentication plugin for [Elysia](https://elysiajs.com/) + [Bun](https://bun.sh/).

> **Bun-only.** Uses `Bun.password` (native Argon2id) and `Bun.redis` (native Redis client). No extra native dependencies required.

---

## Features

- **JWT authentication** — access + refresh token rotation via httpOnly cookies
- **Argon2id password hashing** — via Bun's native `Bun.password` API, zero extra deps
- **Redis-backed sessions** — refresh tokens, JWT blacklist on logout, OTP storage
- **Email verification** — SHA-256 tokenized flow, built-in Resend adapter
- **Password reset** — OTP-based flow with anti-enumeration protection
- **Guards** — `authGuard`, `verifiedGuard`, `requiredRole()` factory for RBAC
- **Rate limiting** — Redis-backed, graceful degradation when Redis is down
- **Adapter pattern** — bring your own email provider and user store (Drizzle helper included)
- **Zod validation** — all inputs validated, all config type-safe

## Requirements

- Bun >= 1.0
- Elysia >= 1.0
- Redis instance

## Installation

> **Work in progress.** Not yet published to npm. Star the repo to follow progress.

## Quick start

```typescript
import { Elysia } from "elysia"
import { elysiaAuth } from "velvet-auth"
import { ResendAdapter } from "velvet-auth/adapters/email"
import { drizzleUserAdapter } from "velvet-auth/adapters/user-store"
import { db, schema } from "./db"

const app = new Elysia()
  .use(elysiaAuth({
    jwt: {
      secret: process.env.JWT_SECRET, // min 32 chars
      expiresIn: "15m",
    },
    redis: {
      url: process.env.REDIS_URL,     // default: "redis://localhost:6379"
    },
    userStore: drizzleUserAdapter(db, schema.users),
    email: new ResendAdapter({
      apiKey: process.env.RESEND_API_KEY,
      from: "noreply@yourapp.com",
    }),
  }))
  .listen(3000)
```

This mounts the following routes under `/auth` automatically:

| Method | Route | Auth required |
|--------|-------|---------------|
| `POST` | `/auth/register` | No |
| `POST` | `/auth/login` | No |
| `POST` | `/auth/logout` | Yes |
| `POST` | `/auth/refresh` | No (refresh cookie) |
| `POST` | `/auth/forgot-password` | No |
| `POST` | `/auth/reset-password` | No |
| `GET`  | `/auth/verify-email` | No |
| `POST` | `/auth/resend-verification` | No |
| `GET`  | `/auth/me` | Yes |

## Guards

```typescript
import { authGuard, verifiedGuard, requiredRole } from "velvet-auth"

// Requires valid JWT → injects ctx.user
app.use(authGuard).get("/me", ({ user }) => user)

// Requires JWT + emailVerified === true
app.use(verifiedGuard).post("/reports", createReport)

// Requires JWT + role match
app.use(requiredRole("ADMIN")).get("/admin/stats", getStats)
app.use(requiredRole("ADMIN", "MOD")).delete("/content/:id", deleteContent)
```

## Configuration

All options with their defaults:

```typescript
elysiaAuth({
  // Required
  jwt: {
    secret: string,          // min 32 chars
    expiresIn: "15m",
  },
  redis: {
    url: "redis://localhost:6379",
  },
  userStore: UserStoreAdapter,
  email: EmailAdapter,

  // Optional
  tokens: {
    refreshTtl: 7 * 24 * 60 * 60,   // 7 days
    otpTtl: 15 * 60,                 // 15 min
    verificationTtl: 24 * 60 * 60,  // 24h
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
  rateLimit: {
    auth: { max: 10, window: 60 },   // 10 req/min on sensitive routes
  },
  prefix: "/auth",
  routes: {
    forgotPassword: true,
    emailVerification: true,
  },
})
```

## Custom adapters

### Email adapter

```typescript
import type { EmailAdapter } from "velvet-auth/adapters/email"

class MyEmailAdapter implements EmailAdapter {
  async sendOtp(to: string, otp: string): Promise<void> {
    // send OTP email
  }
  async sendVerification(to: string, url: string): Promise<void> {
    // send verification email
  }
  async checkStatus(): Promise<boolean> {
    // health check
    return true
  }
}
```

### User store adapter

```typescript
import type { UserStoreAdapter } from "velvet-auth/adapters/user-store"

const myUserStore: UserStoreAdapter = {
  findById: async (id) => { /* ... */ },
  findByUsername: async (username) => { /* ... */ },
  findByEmail: async (email) => { /* ... */ },
  create: async (data) => { /* ... */ },
  updatePassword: async (id, hash) => { /* ... */ },
  setEmailVerified: async (id) => { /* ... */ },
}
```

The `drizzleUserAdapter(db, schema.users)` helper maps a Drizzle table to this interface automatically.

## Types

```typescript
// Minimum shape required from a user record
interface AuthUser {
  id: string
  username: string
  email: string
  password: string       // Argon2id hash
  role: string
  emailVerified: boolean
}

// What gets injected into ctx.user by the guards
interface AuthContext {
  id: string
  username: string
  role: string
  emailVerified: boolean
}
```

## Security design

| Concern | Approach |
|---------|----------|
| Password hashing | Argon2id via `Bun.password` (native, no deps) |
| OTP hashing | Argon2id at lower cost (temporary, 15 min TTL) |
| Email verification | SHA-256 of a random 32-byte token, stored in Redis |
| Refresh tokens | UUID stored in Redis, consumed atomically with `GETDEL` |
| JWT revocation | JTI blacklist in Redis on logout, TTL = remaining token lifetime |
| Cookies | `httpOnly`, `sameSite=lax`, `secure` in production |
| Anti-enumeration | `forgot-password` returns success even for unknown users |
| Rate limiting | Redis `INCR` with atomic TTL assignment, graceful Redis-down degradation |

## Error responses

All errors follow a consistent shape:

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`.

## Roadmap

- **v0.1** — Core: security primitives, guards, login/register/logout/refresh
- **v0.2** — Email flows: forgot/reset password, email verification
- **v0.3** — Adapters & RBAC: `verifiedGuard`, `requiredRole`, Drizzle helper, Redis rate limiter
- **v1.0** — npm/JSR publish, full test suite

## License

MIT
