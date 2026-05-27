import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { ONBOARDING_COOKIE_NAME } from "@/lib/auth/session";

const publicRoutes = ["/login", "/definir-senha"];
const publicPrefixes = ["/_next", "/q/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname);
  const env = getServerEnv();
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookieValues) {
          cookieValues.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const sessionResponse = supabase.auth.getUser();
  const onboardingState = request.cookies.get(ONBOARDING_COOKIE_NAME)?.value;

  return sessionResponse.then(({ data, error }) => {
    const hasSession = !!data.user && !error;
    const needsOnboarding = hasSession && onboardingState !== "done";
    const withAuthCookies = (nextResponse: NextResponse) => {
      response.cookies.getAll().forEach((cookie) => {
        nextResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      return nextResponse;
    };

    if (!hasSession && !isPublicRoute) {
      return withAuthCookies(NextResponse.redirect(new URL("/login", request.url)));
    }

    if (hasSession && publicRoutes.includes(pathname)) {
      return withAuthCookies(NextResponse.redirect(new URL("/", request.url)));
    }

    if (needsOnboarding && pathname !== "/primeiro-acesso") {
      return withAuthCookies(NextResponse.redirect(new URL("/primeiro-acesso", request.url)));
    }

    if (!needsOnboarding && pathname === "/primeiro-acesso") {
      return withAuthCookies(NextResponse.redirect(new URL("/", request.url)));
    }

    return withAuthCookies(response);
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
