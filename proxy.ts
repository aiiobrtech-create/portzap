import { NextRequest, NextResponse } from "next/server";
import { ONBOARDING_COOKIE_NAME } from "@/lib/auth/session";

const publicRoutes = ["/login", "/definir-senha"];
const publicPrefixes = ["/_next", "/q/"];

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname);
  const hasSession = hasSupabaseSessionCookie(request);
  const onboardingState = request.cookies.get(ONBOARDING_COOKIE_NAME)?.value;
  const needsOnboarding = hasSession && onboardingState !== "done";

  if (!hasSession && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (needsOnboarding && pathname !== "/primeiro-acesso") {
    return NextResponse.redirect(new URL("/primeiro-acesso", request.url));
  }

  if (!needsOnboarding && pathname === "/primeiro-acesso") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
