import { isSitePath } from "./content/rich-text";

export type RedirectRule = { source: string; destination: string; permanent: boolean; enabled: boolean };

export const GONE_PATHS = /^\/(?:(?:listings|browse|auctions|events|blog|vet|vets|seller|shops|become-seller|become-vet|buyer|individuals|inquiries|following|notifications|messages|profile|pricing|careers|auth|mcp)(?:\/.*)?|shop-not-found|maintenance)$/;

const RESERVED_SOURCE = /^\/(?:$|admin(?:\/|$)|api(?:\/|$)|_next(?:\/|$)|images(?:\/|$)|textures(?:\/|$)|hdri(?:\/|$)|login$|register$|checkout$|shop$|robots\.txt$|sitemap\.xml$|llms\.txt$)/;
const SOURCE_SHAPE = /^\/[A-Za-z0-9\-._~/%]+$/;
const PROBE_ORIGIN = "http://site.invalid";
const ROUTE_REDIRECTS = [["/shop", "/shop/leather"]] as const;
export const MAX_CHAIN = 5;

export const redirectPath = (value: string) => value.split(/[?#]/)[0]!.replace(/(?<=.)\/+$/, "");

const landingPath = (value: string) => redirectPath(URL.canParse(value, PROBE_ORIGIN) ? new URL(value, PROBE_ORIGIN).pathname.replace(/\/{2,}/g, "/") : value);

export const isRedirectSource = (value: string) => SOURCE_SHAPE.test(value) && !value.includes("//") && !value.includes("..") && redirectPath(value) === value && !RESERVED_SOURCE.test(value);
export const isRedirectDestination = (value: string) => isSitePath(value) && !GONE_PATHS.test(redirectPath(value));

export function redirectProblem(rules: RedirectRule[], index: number): string | null {
  const live = new Map<string, string>([...ROUTE_REDIRECTS, ...rules.filter((rule) => rule.enabled).map((rule) => [rule.source, landingPath(rule.destination)] as const)]);
  const start = rules[index]!;
  if (!start.enabled) return null;
  const seen = new Set([start.source]);
  let next = landingPath(start.destination);
  for (let hops = 1; ; hops += 1) {
    if (seen.has(next)) return next === start.source ? "This sends people back to where they started. Pick a different page." : "This sends people round in a circle. Pick a different page.";
    const after = live.get(next);
    if (after === undefined) return null;
    if (hops >= MAX_CHAIN) return `This passes people through more than ${MAX_CHAIN} pages. Send them straight to the final page.`;
    seen.add(next);
    next = after;
  }
}

export function usableRules(rules: unknown): Map<string, RedirectRule> {
  const table = new Map<string, RedirectRule>();
  if (!Array.isArray(rules)) return table;
  const valid = rules.filter((rule): rule is RedirectRule => typeof rule?.source === "string" && typeof rule?.destination === "string" && isRedirectSource(rule.source) && isRedirectDestination(rule.destination));
  valid.forEach((rule, index) => {
    if (rule.enabled !== false && !redirectProblem(valid, index)) table.set(rule.source, rule);
  });
  return table;
}

export function redirectTarget(rule: RedirectRule, search: string) {
  return !search || rule.destination.includes("?") ? rule.destination : rule.destination.includes("#") ? rule.destination.replace("#", `${search}#`) : `${rule.destination}${search}`;
}

const shared = globalThis as unknown as { occuinRedirectEpoch?: number };
export const redirectEpoch = () => shared.occuinRedirectEpoch ?? 0;
export const bumpRedirectEpoch = () => {
  shared.occuinRedirectEpoch = redirectEpoch() + 1;
};
