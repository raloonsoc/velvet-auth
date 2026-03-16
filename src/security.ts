import type { ResolvedConfig } from "./config";
import { randomInt, randomBytes } from "node:crypto";

// --- Generate ---

/** Generates a zero-padded numeric OTP of the given length. */
export function generateOTP(length: number = 6) {
  const max = 10 ** length;
  const number = randomInt(0, max);
  return number.toString().padStart(length, "0");
}

/** Generates a 32-byte random token for email verification (sent in the email link). */
export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

// --- Hash ---

/** Hash password with Argon2id */
export async function hashPassword(plain: string, config: ResolvedConfig) {
  return Bun.password.hash(plain, {
    algorithm: "argon2id",
    memoryCost: config.argon2.memoryCost,
    timeCost: config.argon2.timeCost,
  });
}

/** Hashes an OTP with Argon2id at low cost — intentionally cheaper since OTPs are short-lived (15 min). */
export async function hashOTP(otp: string) {
  return Bun.password.hash(otp, {
    algorithm: "argon2id",
    memoryCost: 19456,
    timeCost: 2,
  });
}

/** Hashes a verification token with SHA-256. Only the hash is stored in Redis, never the raw token. */
export function hashVerificationToken(token: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(token);
  return hasher.digest("hex");
}

// --- Verify ---

/** Verifies a plain-text password against an Argon2id hash. */
export async function verifyPassword(plain: string, hash: string) {
  return Bun.password.verify(plain, hash);
}

/** Verifies a plain-text OTP against its Argon2id hash. */
export async function verifyOTP(otp: string, hash: string) {
  return Bun.password.verify(otp, hash);
}
