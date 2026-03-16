import type { AuthUser, CreateUserInput } from "../../types";

export interface UserStoreAdapter {
  /** Finds a user by their ID. Returns null if not found. */
  findById(id: string): Promise<AuthUser | null>;

  /** Finds a user by username. Returns null if not found. */
  findByUsername(username: string): Promise<AuthUser | null>;

  /** Finds a user by email. Returns null if not found. */
  findByEmail(email: string): Promise<AuthUser | null>;

  /** Persists a new user and returns the created record. */
  create(data: CreateUserInput): Promise<AuthUser>;

  /** Updates the stored password hash for a user.. */
  updatePassword(id: string, hash: string): Promise<void>;

  /** Marks a user's email as verified. */
  setEmailVerified(id: string): Promise<void>;
}
