const BODY = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>This page is gone | OCCUIN</title></head><body style="font-family:Georgia,serif;text-align:center;padding:15vh 24px;color:#17312a"><h1>This page is gone</h1><p>OCCUIN is now a leather goods house.</p><p><a href="https://occuin.com/" style="color:#17312a">Visit the shop</a></p></body></html>`;

export function proxy() {
  return new Response(BODY, {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}

export const config = {
  matcher: [
    "/listings/:path*",
    "/browse/:path*",
    "/auctions/:path*",
    "/events/:path*",
    "/blog/:path*",
    "/vet/:path*",
    "/vets/:path*",
    "/seller/:path*",
    "/shops/:path*",
    "/shop-not-found",
    "/become-seller/:path*",
    "/become-vet/:path*",
    "/buyer/:path*",
    "/individuals/:path*",
    "/inquiries/:path*",
    "/following/:path*",
    "/notifications/:path*",
    "/messages/:path*",
    "/profile/:path*",
    "/pricing/:path*",
    "/careers/:path*",
    "/auth/:path*",
    "/maintenance",
    "/mcp/:path*",
  ],
};
