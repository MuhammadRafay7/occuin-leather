const PROBE_ORIGIN = "http://orsel.invalid";

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
