import { auth } from "@/lib/auth";
import { isAdmin, isModerator } from "@/lib/rbac";

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.id || !isModerator(session.user.role)) {
    return null;
  }
  return session;
}

/** ADMIN only — payment write actions, role changes, brand deactivate. */
export async function requireSuperAdminSession() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return null;
  }
  return session;
}
