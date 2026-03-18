import { test, expect } from "bun:test";
import Elysia from "elysia";
import { velvetAuth } from "../src/index";
import type { UserStoreAdapter } from "../src/adapters/user-store/base";
import type { EmailAdapter } from "../src/adapters/email/base";
import type { AuthUser } from "../src/types";

const BASE = "http://localhost";
const JWT_SECRET = "supersecretkey32charactersatleast!!";

function createTestAdapters() {
  const users: AuthUser[] = [];

  const userStore: UserStoreAdapter = {
    findById: async (id) => users.find((u) => u.id === id) ?? null,
    findByUsername: async (username) =>
      users.find((u) => u.username === username) ?? null,
    findByEmail: async (email) => users.find((u) => u.email === email) ?? null,
    create: async (input) => {
      const user: AuthUser = {
        id: crypto.randomUUID(),
        emailVerified: false,
        role: "user",
        ...input,
      };
      users.push(user);
      return user;
    },
    updatePassword: async (id, password) => {
      const user = users.find((u) => u.id === id);
      if (user) user.password = password;
    },
    setEmailVerified: async (id) => {
      const user = users.find((u) => u.id === id);
      if (user) user.emailVerified = true;
    },
  };

  const emailAdapter: EmailAdapter = {
    sendOtp: async () => {},
    sendVerification: async () => {},
    checkStatus: async () => true,
  };

  return { userStore, emailAdapter };
}

function createApp() {
  const { userStore, emailAdapter } = createTestAdapters();
  return new Elysia().use(
    velvetAuth(userStore, emailAdapter, {
      jwt: { secret: JWT_SECRET },
      routes: { emailVerification: false, forgotPassword: false },
    }),
  );
}

function getCookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

function json(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const validUser = {
  username: "raul",
  email: "raul@test.com",
  password: "Test1234!",
};

// --- Register ---

test("register: creates user and returns data without password", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    user: {
      username: string;
      password?: string;
      success?: boolean;
    };
  };
  expect(body.user.username).toBe("raul");
  expect(body.user.password).toBeUndefined();
});

test("register: sets access and refresh cookies", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );

  const cookies = getCookies(res);
  expect(cookies).toContain("access_token=");
  expect(cookies).toContain("refresh_token=");
});

test("register: rejects duplicate username with 400", async () => {
  const app = createApp();
  await app.handle(new Request(`${BASE}/auth/register`, json(validUser)));
  const res = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );

  expect(res.status).toBe(400);
});

test("register: rejects duplicate email with 400", async () => {
  const app = createApp();
  await app.handle(new Request(`${BASE}/auth/register`, json(validUser)));
  const res = await app.handle(
    new Request(
      `${BASE}/auth/register`,
      json({ ...validUser, username: "other" }),
    ),
  );

  expect(res.status).toBe(400);
});

// --- Login ---

test("login: returns 200 and cookies with valid credentials", async () => {
  const app = createApp();
  await app.handle(new Request(`${BASE}/auth/register`, json(validUser)));
  const res = await app.handle(
    new Request(
      `${BASE}/auth/login`,
      json({ username: validUser.username, password: validUser.password }),
    ),
  );

  expect(res.status).toBe(200);
  expect(getCookies(res)).toContain("access_token=");
});

test("login: rejects wrong password with 401", async () => {
  const app = createApp();
  await app.handle(new Request(`${BASE}/auth/register`, json(validUser)));
  const res = await app.handle(
    new Request(
      `${BASE}/auth/login`,
      json({ username: validUser.username, password: "Wrong1234!" }),
    ),
  );

  expect(res.status).toBe(401);
});

test("login: rejects unknown user with 401", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(
      `${BASE}/auth/login`,
      json({ username: "noexiste", password: "Test1234!" }),
    ),
  );

  expect(res.status).toBe(401);
});

// --- Logout ---

test("logout: returns 200 and clears cookies", async () => {
  const app = createApp();
  const registerRes = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );
  const cookies = getCookies(registerRes);

  const res = await app.handle(
    new Request(`${BASE}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookies },
    }),
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.success).toBe(true);
});

test("logout: second logout with same token returns 401", async () => {
  const app = createApp();
  const registerRes = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );
  const cookies = getCookies(registerRes);

  await app.handle(
    new Request(`${BASE}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookies },
    }),
  );

  const res = await app.handle(
    new Request(`${BASE}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookies },
    }),
  );

  expect(res.status).toBe(401);
});

test("logout: without token returns 401", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/logout`, { method: "POST" }),
  );

  expect(res.status).toBe(401);
});

// --- Refresh ---

test("refresh: returns 200 and new cookies", async () => {
  const app = createApp();
  const registerRes = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );
  const cookies = getCookies(registerRes);

  const res = await app.handle(
    new Request(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookies },
    }),
  );

  expect(res.status).toBe(200);
  expect(getCookies(res)).toContain("access_token=");
  expect(getCookies(res)).toContain("refresh_token=");
});

test("refresh: without cookie returns 401", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/refresh`, { method: "POST" }),
  );

  expect(res.status).toBe(401);
});

test("refresh: same refresh token cannot be used twice", async () => {
  const app = createApp();
  const registerRes = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );
  const cookies = getCookies(registerRes);

  await app.handle(
    new Request(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookies },
    }),
  );

  const res = await app.handle(
    new Request(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookies },
    }),
  );

  expect(res.status).toBe(401);
});
