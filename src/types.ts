// --- INTERFACES ---

/** Minimum shape a user record must satisfy for the plugin to work. */
interface AuthUser {
  id: string;
  username: string;
  email: string;
  password: string; // Argon2id hash
  role: string;
  emailVerified: boolean;
}

/** Data encoded inside the JWT when it is signed. */
interface TokenPayload {
  id: string;
  username: string;
  role: string;
  emailVerified: boolean;
  jti: string; // Unique token id, used for blacklisting on logout
}

/** User data injected into ctx.user by the auth guard. */
interface AuthContext {
  id: string;
  username: string;
  role: string;
  emailVerified: boolean;
}

/** Data passed to userStore.create() when registering a new user. */
interface CreateUserInput {
  username: string;
  email: string;
  password: string; // Already hashed by the plugin before calling adapter
}
