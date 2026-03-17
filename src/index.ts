export { velvetAuth } from "./plugin";
export { createAuthGuard } from "./guards/auth.guard";

export type {
  AuthUser,
  TokenPayload,
  AuthContext,
  CreateUserInput,
} from "./types";
export type { UserStoreAdapter } from "./adapters/user-store/base";
export type { EmailAdapter } from "./adapters/email/base";
export type { AuthConfig } from "./config";

export {
  AppError,
  AuthError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
} from "./errors";
