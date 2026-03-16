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

test("register: crea usuario y devuelve datos sin password", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.user.username).toBe("raul");
  expect(body.user.password).toBeUndefined();
});

test("register: setea cookies de access y refresh", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );

  const cookies = getCookies(res);
  expect(cookies).toContain("access_token=");
  expect(cookies).toContain("refresh_token=");
});

test("register: rechaza username duplicado con 400", async () => {
  const app = createApp();
  await app.handle(new Request(`${BASE}/auth/register`, json(validUser)));
  const res = await app.handle(
    new Request(`${BASE}/auth/register`, json(validUser)),
  );

  expect(res.status).toBe(400);
});

test("register: rechaza email duplicado con 400", async () => {
  const app = createApp();
  await app.handle(new Request(`${BASE}/auth/register`, json(validUser)));
  const res = await app.handle(
    new Request(
      `${BASE}/auth/register`,
      json({ ...validUser, username: "otro" }),
    ),
  );

  expect(res.status).toBe(400);
});

// --- Login ---

test("login: devuelve 200 y cookies con credenciales válidas", async () => {
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

test("login: rechaza password incorrecto con 401", async () => {
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

test("login: rechaza usuario inexistente con 401", async () => {
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

test("logout: devuelve 200 y elimina cookies", async () => {
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
  const body = await res.json();
  expect(body.success).toBe(true);
});

test("logout: segundo logout con mismo token devuelve 401", async () => {
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

test("logout: sin token devuelve 401", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/logout`, { method: "POST" }),
  );

  expect(res.status).toBe(401);
});

// --- Refresh ---

test("refresh: devuelve 200 y nuevas cookies", async () => {
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

test("refresh: sin cookie devuelve 401", async () => {
  const app = createApp();
  const res = await app.handle(
    new Request(`${BASE}/auth/refresh`, { method: "POST" }),
  );

  expect(res.status).toBe(401);
});

test("refresh: mismo refresh token no se puede usar dos veces", async () => {
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
