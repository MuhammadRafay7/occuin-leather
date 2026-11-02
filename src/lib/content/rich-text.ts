export const CONTENT_TOKENS = {
  brand: "Brand name",
  email: "Support email from Settings",
  whatsapp_url: "WhatsApp chat link, empty when no number is set",
  making_time: "Making time, such as 25 to 30 days",
  making_note: "Full sentence about making time",
  bespoke_note: "Full sentence about bespoke timing",
  standard_arrival: "Tracked delivery time",
  express_arrival: "Express delivery time",
  standard_label: "Tracked shipping name",
  express_label: "Express shipping name",
  standard_price: "Tracked shipping price from Settings",
  express_price: "Express shipping price from Settings",
  free_shipping_note: "Free shipping sentence from Settings",
  countries: "Every country at checkout",
  country_count: "Number of countries at checkout",
  studio_finishes: "Studio leather names",
  price_from: "Lowest listed product price",
  price_to: "Highest listed product price",
  year: "Current year",
  payment_answer: "How customers pay, in the current payment mode",
  payment_lead: "Opening sentence about payment, empty with Stripe",
  payment_privacy: "How payment details are handled, in the current payment mode",
  payment_summary: "One line on how payment works, in the current payment mode",
} as const;

export type TokenName = keyof typeof CONTENT_TOKENS;
export type TokenValues = Partial<Record<TokenName, string>>;

const TOKEN = /\{\{\s*([\w-]*)\s*\}\}/g;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const PROBE_ORIGIN = "http://site.invalid";
const CONTROL = /[\u0000-\u001f\u007f]/;

export function isSitePath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || CONTROL.test(value)) return false;
  try {
    const url = new URL(value, PROBE_ORIGIN);
    return url.origin === PROBE_ORIGIN && !url.pathname.startsWith("//");
  } catch {
    return false;
  }
}

export function isHttpsUrl(value: string) {
  if (CONTROL.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const isSafeHref = (value: string) => isSitePath(value) || isHttpsUrl(value);
const isEmailLink = (value: string) => /^mailto:[^\s<>"]+@[^\s<>"]+$/.test(value);
export const isSafeInlineHref = (value: string) => isSafeHref(value) || isEmailLink(value);

export const fillTokens = (text: string, values: TokenValues) => text.replace(TOKEN, (_, name: string) => values[name as TokenName] ?? "");

export const unknownTokens = (text: string) =>
  [...text.matchAll(TOKEN)].map((match) => match[1]!).filter((name) => !Object.hasOwn(CONTENT_TOKENS, name));

export const hasToken = (text: string, prefix = "") => [...text.matchAll(TOKEN)].some((match) => match[1]!.startsWith(prefix));

export type RichPart = { kind: "text" | "link" | "value"; raw: string; label: string; href?: string; name?: TokenName };

const RICH = /\[[^\]\n]+\]\([^)\s]+\)|\{\{\s*[\w-]*\s*\}\}/g;

function richPart(raw: string): RichPart {
  if (raw.startsWith("[")) {
    const [, label, href] = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(raw)!;
    return { kind: "link", raw, label: label!, href };
  }
  const name = raw.slice(2, -2).trim();
  return Object.hasOwn(CONTENT_TOKENS, name) ? { kind: "value", raw, label: name, name: name as TokenName } : { kind: "text", raw, label: raw };
}

export function splitRich(text: string): RichPart[] {
  const parts: RichPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(RICH)) {
    if (match.index > cursor) parts.push({ kind: "text", raw: text.slice(cursor, match.index), label: text.slice(cursor, match.index) });
    parts.push(richPart(match[0]));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: "text", raw: text.slice(cursor), label: text.slice(cursor) });
  return parts;
}

export type InlinePart = { text: string; href?: string };

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label, href] = match;
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    parts.push(isSafeInlineHref(href!) ? { text: label!, href } : { text: label! });
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export const plainText = (text: string) => parseInline(text).map((part) => part.text).join("");

export function textProblem(text: string): string | null {
  const unknown = unknownTokens(text);
  if (unknown.length) return "This text has a live detail we do not recognise. Delete it, then use Add a live detail.";
  if (/<[a-z/!][^>]*>/i.test(text)) return "Please remove the web code from this text. Use Add link for links.";
  for (const [, , href] of text.matchAll(LINK)) {
    const probe = href!.replace(TOKEN, "site");
    const whole = /^\{\{\s*whatsapp_url\s*\}\}$/.test(href!);
    if (!whole && !isSafeInlineHref(probe.startsWith("mailto:") ? probe.replace("mailto:site", "mailto:site@site") : probe)) return "One of the links cannot be used. Click it and pick a page from the list, or paste an address starting with https://.";
  }
  return null;
}
