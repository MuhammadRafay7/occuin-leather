import { NextResponse, type NextRequest } from "next/server";

const BODY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>This page is gone | OCCUIN</title></head><body style="font-family:Georgia,serif;text-align:center;padding:15vh 24px;color:#17312a"><h1>This page is gone</h1><p>OCCUIN is now a leather goods house.</p><p><a href="https://occuin.com/" style="color:#17312a">Visit the shop</a></p></body></html>`;
const GONE_PATHS = /^\/(?:(?:listings|browse|auctions|events|blog|vet|vets|seller|shops|become-seller|become-vet|buyer|individuals|inquiries|following|notifications|messages|profile|pricing|careers|auth|mcp)(?:\/.*)?|shop-not-found|maintenance)$/;
const isDev = process.env.NODE_ENV === "development";

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
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

export function proxy(request: NextRequest) {
  if (GONE_PATHS.test(request.nextUrl.pathname)) {
    return new Response(BODY, {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  const policy = contentSecurityPolicy(crypto.randomUUID().replaceAll("-", ""));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|images/|textures/|hdri/|icon\\.svg|favicon\\.ico|robots\\.txt|sitemap\\.xml|llms\\.txt|logo-).*)"],
};
