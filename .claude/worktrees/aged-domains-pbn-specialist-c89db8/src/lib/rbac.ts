import { UserRole } from "@prisma/client";

export function isAdmin(role?: UserRole | string | null): boolean {
  return role === UserRole.ADMIN;
}

export function isModerator(role?: UserRole | string | null): boolean {
  return role === UserRole.MODERATOR || role === UserRole.ADMIN;
}

export function isBrandOwner(role?: UserRole | string | null): boolean {
  return (
    role === UserRole.BRAND_OWNER ||
    role === UserRole.MODERATOR ||
    role === UserRole.ADMIN
  );
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function requireRole(
  role: UserRole | string | undefined | null,
  allowed: UserRole[],
): void {
  if (!role || !allowed.includes(role as UserRole)) {
    throw new ForbiddenError();
  }
}
