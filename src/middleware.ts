import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth-edge";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const protectedPrefixes = ["/dashboard", "/admin"];

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(ru|kk)(\/.*)?$/);
  const locale = localeMatch?.[1] ?? "ru";
  const pathWithoutLocale = localeMatch?.[2] ?? "/";

  const isProtected = protectedPrefixes.some(
    (prefix) =>
      pathWithoutLocale === prefix || pathWithoutLocale.startsWith(`${prefix}/`),
  );

  if (isProtected) {
    const session = await auth();
    if (!session?.user) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (
      pathWithoutLocale.startsWith("/admin") &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "MODERATOR"
    ) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
