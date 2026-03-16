import type { RedisClient } from "bun";

// --- Refresh tokens ---

/** Stores a refresh token mapped to a userId with a TTL in seconds. */
export async function setRefreshToken(
  redis: RedisClient,
  token: string,
  userId: string,
  ttl: number,
) {
  await redis.set(`refresh:${token}`, userId, "EX", ttl);
}

/** Atomically reads and deletes a refresh token. Returns userId or null if expired/not found. */
export async function getdelRefreshToken(
  redis: RedisClient,
  token: string,
): Promise<string | null> {
  return redis.getdel(`refresh:${token}`);
}

// --- JWT blacklist ---

/** Blacklists a JWT by its JTI for the remaining lifetime of the token. */
export async function blacklistToken(
  redis: RedisClient,
  jti: string,
  ttl: number,
) {
  await redis.set(`blacklist:${jti}`, "1", "EX", ttl);
}

/** Returns true if a JTI is blacklisted. */
export async function isBlacklisted(
  redis: RedisClient,
  jti: string,
): Promise<boolean> {
  const result = await redis.get(`blacklist:${jti}`);
  return result !== null;
}

// --- OTP ---

/** Stores an OTP hash for a user with a TTL in seconds. */
export async function setOtp(
  redis: RedisClient,
  userId: string,
  hash: string,
  ttl: number,
) {
  await redis.set(`otp:${userId}`, hash, "EX", ttl);
}

/** Atomically reads and deletes an OTP hash. Returns null if expired/not found. */
export async function getdelOtp(
  redis: RedisClient,
  userId: string,
): Promise<string | null> {
  return redis.getdel(`otp:${userId}`);
}

// --- Email verification ---

/** Stores a verification token hash for a user with a TTL in seconds. */
export async function setVerificationToken(
  redis: RedisClient,
  userId: string,
  hash: string,
  ttl: number,
) {
  await redis.set(`verification:${userId}`, hash, "EX", ttl);
}

/** Atomically reads and deletes a verification token hash. Returns null if expired/not found. */
export async function getdelVerificationToken(
  redis: RedisClient,
  userId: string,
): Promise<string | null> {
  return redis.getdel(`verification:${userId}`);
}
