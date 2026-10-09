// ============================================
// MIDDLEWARE - I18N + AUTH PROTECTION
// ============================================
// Combines next-intl locale routing with NextAuth protection
// - Detects user's preferred language from Accept-Language header
// - Redirects to correct locale if none is present in URL
// - Protects /[locale]/dashboard routes with NextAuth
// - API routes are excluded from locale routing
// ============================================

import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { locales, defaultLocale } from "./i18n";
import {
  getCountryCodeFromHeaders,
  getCurrencyForCountryCode,
  getLocaleForCountryCode,
  pickSupportedLocaleFromAcceptLanguage,
  type Units,
} from "./lib/geo-preferences";
import { isSupportedCurrency, type Currency } from "./lib/currency";

// Create next-intl middleware
const intlMiddleware = createMiddleware({
  locales: locales as unknown as string[], // Keep in sync with i18n.ts
  defaultLocale: defaultLocale,
  localePrefix: "always", // Always show locale in URL (e.g., /en/properties)
});

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude API routes from locale routing and auth
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Exclude static files and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Detect country once (lowest priority defaults)
  const countryCode = getCountryCodeFromHeaders(request.headers);

  // ---------- USER OVERRIDES (highest priority) ----------
  const currencyOverride = request.cookies.get("NEXT_CURRENCY_OVERRIDE")?.value;
  const unitsOverride = request.cookies.get("NEXT_UNITS_OVERRIDE")?.value;
  const localeOverride = request.cookies.get("NEXT_LOCALE_OVERRIDE")?.value;

  // ---------- EXISTING COOKIES (persist previous choice/default) ----------
  const currencyCookie = request.cookies.get("NEXT_CURRENCY")?.value;
  const unitsCookie = request.cookies.get("NEXT_UNITS")?.value;
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;

  // ---------- URL LOCALE (for language) ----------
  const urlLocale = pathname.split("/")[1];
  const urlLocaleSupported = (locales as readonly string[]).includes(urlLocale);
  const hasLocalePrefix = (locales as readonly string[]).some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );

  const geoLocale = getLocaleForCountryCode(
    countryCode,
    locales as readonly import("./i18n").Locale[],
    defaultLocale
  );

  // ---------- EFFECTIVE PREFERENCES ----------
  // Priority: explicit override → URL locale (if present) → saved cookie →
  // IP country → Accept-Language → default
  const effectiveLocale =
    (localeOverride && (locales as readonly string[]).includes(localeOverride)
      ? localeOverride
      : undefined) ??
    (hasLocalePrefix && urlLocaleSupported ? urlLocale : undefined) ??
    (localeCookie && (locales as readonly string[]).includes(localeCookie)
      ? localeCookie
      : undefined) ??
    geoLocale ??
    pickSupportedLocaleFromAcceptLanguage(
      request.headers.get("accept-language"),
      locales as any,
      defaultLocale
    );

  // --------------------------------------------
  // SUPERADMIN AREA (NON-LOCALIZED): /admin/*
  // --------------------------------------------
  // We intentionally keep /admin outside of locale routing.
  // Access is restricted strictly to authenticated SUPERADMIN users.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Not authenticated -> send to localized home (or login if you prefer)
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = `/${effectiveLocale}`;
      return NextResponse.redirect(url);
    }

    // Authenticated but not SUPERADMIN -> send to localized dashboard
    if ((token as any)?.role !== "SUPERADMIN") {
      const url = request.nextUrl.clone();
      url.pathname = `/${effectiveLocale}/dashboard`;
      return NextResponse.redirect(url);
    }

    // Allowed
    return NextResponse.next();
  }

  let targetCurrency: Currency =
    (isSupportedCurrency(currencyOverride) ? currencyOverride : undefined) ??
    (isSupportedCurrency(currencyCookie) ? currencyCookie : undefined) ??
    getCurrencyForCountryCode(countryCode);

  // Units default: metric for almost everyone in Europe.
  // Only show imperial by default for US/UK, or when user explicitly overrides.
  let targetUnits: Units =
    (unitsOverride === "metric" || unitsOverride === "imperial"
      ? (unitsOverride as Units)
      : undefined) ??
    (countryCode && ["US", "GB"].includes(countryCode.toUpperCase())
      ? "imperial"
      : "metric");

  // Aggressive redirect: ensure locale prefix is always present and matches preference on first hit.
  if (pathname === "/" || !hasLocalePrefix) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/"
        ? `/${effectiveLocale}`
        : `/${effectiveLocale}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.cookies.set("NEXT_CURRENCY", targetCurrency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    redirectResponse.cookies.set("NEXT_UNITS", targetUnits, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    redirectResponse.cookies.set("NEXT_LOCALE", effectiveLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return redirectResponse;
  }

  // First, apply intl middleware to handle locale routing
  const intlResponse = intlMiddleware(request);
  
  // Clone the response to add currency cookie
  let response: NextResponse;
  
  // If intl middleware redirects (no locale in path), clone the redirect
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    const location = intlResponse.headers.get("location") || request.url;
    response = NextResponse.redirect(new URL(location, request.url));
  } else {
    // Clone the response
    response = new NextResponse(intlResponse.body, {
      status: intlResponse.status,
      statusText: intlResponse.statusText,
      headers: intlResponse.headers,
    });
  }

  // Set cookies if needed (never overwrite override cookies, only sync NEXT_* to effective)
  if (!currencyCookie || currencyCookie !== targetCurrency) {
    response.cookies.set("NEXT_CURRENCY", targetCurrency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
  }

  if (!unitsCookie || unitsCookie !== targetUnits) {
    response.cookies.set("NEXT_UNITS", targetUnits, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  if (!localeCookie || localeCookie !== effectiveLocale) {
    response.cookies.set("NEXT_LOCALE", effectiveLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // Check if the path is a dashboard route (after locale routing)
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/dashboard`) || pathname === `/${locale}/dashboard`
  );

  // For dashboard routes, check authentication
  if (pathnameHasLocale) {
    // Extract locale
    const locale = pathname.split("/")[1];
    
    // Get token from cookies
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // If not authenticated, redirect to localized login
    if (!token) {
      const redirectResponse = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
      if (!currencyCookie || currencyCookie !== targetCurrency) {
        redirectResponse.cookies.set("NEXT_CURRENCY", targetCurrency, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      if (!unitsCookie || unitsCookie !== targetUnits) {
        redirectResponse.cookies.set("NEXT_UNITS", targetUnits, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      if (!localeCookie || localeCookie !== effectiveLocale) {
        redirectResponse.cookies.set("NEXT_LOCALE", effectiveLocale, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      return redirectResponse;
    }

    // If authenticated, continue with response (with currency cookie)
    return response;
  }

  // For all other routes, return response with currency cookie
  return response;
}

export const config = {
  matcher: [
    "/",
    "/(sk|en|cs|de|fr|es|it|pl|hu|pt|nl|ro|bg|hr|el|sv|da|fi|lt|lv|et|uk|ru|zh|ja)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
