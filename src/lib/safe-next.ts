const PROBE_ORIGIN = "http://orsel.invalid";
const ADMIN_HOME = "/admin";

export const ADMIN_LOGIN = "/admin/login";
export const ADMIN_PATH_HEADER = "x-admin-path";

export function safeNext(next: unknown, fallback = "/account") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    const url = new URL(next, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function isAdminPath(pathname: string) {
  return pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`);
}

export function safeAdminNext(next: unknown) {
  const path = safeNext(next, ADMIN_HOME);
  const pathname = path.split(/[?#]/, 1)[0]!;
  const isLogin = pathname === ADMIN_LOGIN || pathname.startsWith(`${ADMIN_LOGIN}/`);
  return isAdminPath(pathname) && !isLogin ? path : ADMIN_HOME;
}

export const adminLoginPath = (next: unknown) => `${ADMIN_LOGIN}?next=${encodeURIComponent(safeAdminNext(next))}`;
