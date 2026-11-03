import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { GONE_PATHS, redirectEpoch, redirectTarget, usableRules, type RedirectRule } from "@/lib/redirects";
import { ADMIN_PATH_HEADER, isAdminPath } from "@/lib/safe-next";

const BODY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>This page is gone | OCCUIN</title></head><body style="font-family:Georgia,serif;text-align:center;padding:15vh 24px;color:#17312a"><h1>This page is gone</h1><p>OCCUIN is now a leather goods house.</p><p><a href="https://occuin.com/" style="color:#17312a">Visit the shop</a></p></body></html>`;
const isDev = process.env.NODE_ENV === "development";
const RULES_TTL_MS = 60_000;
const RETRY_MS = 10_000;
const FIRST_LOAD_WAIT_MS = 250;
const LOAD_TIMEOUT_MS = 2_000;

const table = { rules: new Map<string, RedirectRule>(), loadedAt: 0, epoch: -1, loading: null as Promise<void> | null };

async function loadRules(epoch: number) {
  const origin = process.env.APP_URL;
  if (!origin) return;
  try {
    const response = await fetch(new URL("/api/redirects", origin), { cache: "no-store", signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    table.rules = usableRules(await response.json());
    table.epoch = epoch;
    table.loadedAt = Date.now();
  } catch (error) {
    table.epoch = epoch;
    table.loadedAt = Date.now() - RULES_TTL_MS + RETRY_MS;
    console.error("[proxy] could not load redirects", error);
  } finally {
    table.loading = null;
  }
}

async function findRedirect(request: NextRequest, event: NextFetchEvent) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const epoch = redirectEpoch();
  const changed = epoch !== table.epoch;
  if (changed || Date.now() - table.loadedAt > RULES_TTL_MS) {
    table.loading ??= loadRules(epoch);
    if (changed) await Promise.race([table.loading, new Promise((resolve) => setTimeout(resolve, FIRST_LOAD_WAIT_MS))]);
    else event.waitUntil(table.loading);
  }
  return table.rules.get(request.nextUrl.pathname) ?? null;
}

const PRIVATE_PATHS = /^\/(account|bag|checkout|login|register|reset|orders|unsubscribe|wishlist|bespoke)(\/|$)/;

function contentSecurityPolicy(nonce: string | null) {
  const scripts = nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' blob: data:${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const rule = await findRedirect(request, event);
  if (rule) return NextResponse.redirect(new URL(redirectTarget(rule, request.nextUrl.search), request.url), rule.permanent ? 301 : 302);
  if (GONE_PATHS.test(request.nextUrl.pathname)) {
    return new Response(BODY, {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  const { pathname, search } = request.nextUrl;
  const adminPath = isAdminPath(pathname);
  const strict = adminPath || PRIVATE_PATHS.test(pathname);
  const policy = contentSecurityPolicy(strict ? crypto.randomUUID().replaceAll("-", "") : null);
  const requestHeaders = new Headers(request.headers);
  if (strict) requestHeaders.set("Content-Security-Policy", policy);
  else requestHeaders.delete("Content-Security-Policy");
  requestHeaders.delete(ADMIN_PATH_HEADER);
  if (adminPath) requestHeaders.set(ADMIN_PATH_HEADER, `${pathname}${search}`);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  if (adminPath) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|images/|textures/|hdri/|icon\\.svg|favicon\\.ico|robots\\.txt|sitemap\\.xml|llms\\.txt|logo-).*)"],
};
