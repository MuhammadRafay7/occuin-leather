import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { whatsappChatUrl } from "../bespoke/whatsapp";
import {
  DEFAULT_ABOUT,
  DEFAULT_BESPOKE,
  DEFAULT_CARE,
  DEFAULT_CONTACT,
  DEFAULT_FAQ,
  DEFAULT_HOME,
  DEFAULT_NAV,
  DEFAULT_PRIVACY,
  DEFAULT_REDIRECTS,
  DEFAULT_SEO,
  DEFAULT_SHIPPING,
  DEFAULT_SIZE_GUIDE,
  DEFAULT_TERMS,
  type PresetKey,
} from "../content/defaults";
import { hasToken, isSafeHref, textProblem, unknownTokens, type TokenValues } from "../content/rich-text";
import { arrivalTime, BRAND, DEFAULT_DELIVERY, freeShippingNote, makingNote, makingTime, bespokeNote, money, type Delivery } from "../format";
import { IMAGE_PATH } from "../media";
import { isRedirectDestination, isRedirectSource, redirectProblem } from "../redirects";
import { pageMeta, type SeoContext } from "../seo";
import { STORY_STEPS, type StoryStep } from "../home/story";
import { PRESETS } from "../studio/presets";
import { DEFAULT_PRICING, type StudioPricing } from "../studio/pricing";
import { COLORS, FINISHES, type ColorKey } from "../studio/spec";
import { COUNTRIES } from "../validation";
import { listProducts } from "./catalog";
import { db, schema } from "./db";
import { storedImageSize } from "./media";
import { contactDetails, getSettings, paymentModeOf, type PaymentMode } from "./settings";

const { siteContent } = schema;

const UNDEFINED_TABLE = "42P01";
const DEFAULT_OG_SIZE = { width: 1200, height: 630 };
const NO_CONTROL = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

const text = (max: number) => z.string().trim().min(1, "Please fill this in.").max(max, `That is a little long. Keep it to ${max} characters.`).regex(NO_CONTROL, "This has hidden characters in it. Please retype it.");
const optional = (max: number) => z.string().trim().max(max, `That is a little long. Keep it to ${max} characters.`).regex(NO_CONTROL, "This has hidden characters in it. Please retype it.");

function checked(field: z.ZodString) {
  return field.superRefine((value, context) => {
    const problem = textProblem(value);
    if (problem) context.addIssue({ code: "custom", message: problem });
  });
}

const rich = (max: number) => checked(text(max));
const richOptional = (max: number) => checked(optional(max));

const href = z.string().trim().min(1, "Please pick where this goes.").max(500, "That address is too long.").refine(isSafeHref, "Pick a page from the list, or paste a web address starting with https://.");
const image = z.string().trim().max(200).regex(IMAGE_PATH, "Please choose a picture from the library.");
const link = z.strictObject({ label: text(60), href });

function uniqueBy<T>(items: T[], context: z.RefinementCtx, field: keyof T & string, message: string) {
  const seen = new Set<unknown>();
  items.forEach((item, index) => {
    if (seen.has(item[field])) context.addIssue({ code: "custom", path: [index, field], message });
    seen.add(item[field]);
  });
}

const linkList = (max: number) => z.array(link).max(max, `There is room for ${max} links here.`).superRefine((links, context) => uniqueBy(links, context, "href", "This link is already in the list."));

const blockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("heading"), text: text(160) }),
  z.strictObject({ type: z.literal("paragraph"), text: rich(4000) }),
  z.strictObject({ type: z.literal("list"), items: z.array(rich(1000)).min(1, "Add at least one line.").max(60) }),
  z.strictObject({
    type: z.literal("table"),
    caption: text(160),
    headers: z.array(text(60)).min(1, "Add at least one column.").max(8),
    rows: z.array(z.array(optional(120)).min(1).max(8)).min(1, "Add at least one row.").max(60),
  }).superRefine((table, context) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.headers.length) context.addIssue({ code: "custom", path: ["rows", index], message: "Fill in every box in this row." });
      if (!row[0]) context.addIssue({ code: "custom", path: ["rows", index, 0], message: "Fill in the first box in this row." });
    });
  }),
]);

const blocks = z.array(blockSchema).max(120);

const pageSchema = z.strictObject({ title: text(120), subtitle: richOptional(400), notice: richOptional(600), blocks });

const faqSchema = z.strictObject({
  title: text(120),
  items: z.array(z.strictObject({ question: text(200), answer: rich(3000) })).max(80).superRefine((items, context) => uniqueBy(items, context, "question", "This question is already on the page.")),
});

const aboutSchema = z.strictObject({
  title: text(120),
  image,
  imageAlt: text(200),
  intro: blocks,
  studioHeading: text(120),
  studioBody: rich(1000),
  studioCtaLabel: text(40),
  studioCtaHref: href,
  blocks,
});

const contactSchema = z.strictObject({ title: text(120), whatsappLine: richOptional(300), blocks });

const presetKeys = Object.keys(PRESETS) as [PresetKey, ...PresetKey[]];
const colorKeys = Object.keys(COLORS) as [ColorKey, ...ColorKey[]];

const storyStep = z.strictObject({ title: text(40), body: rich(240) });

const homeSchema = z.strictObject({
  hero: z.strictObject({
    lineOne: text(16),
    lineTwo: text(16),
    ctaLabel: text(24),
    secondaryLabel: text(24).default(DEFAULT_HOME.hero.secondaryLabel),
    secondaryHref: href.default(DEFAULT_HOME.hero.secondaryHref),
    cueLabel: text(30).default(DEFAULT_HOME.hero.cueLabel),
    forms: z.array(z.strictObject({ key: z.enum(presetKeys, "Please pick a style."), label: text(14), slug: text(120) })).min(1, "Keep at least one style.").max(5, "There is room for 5 styles.")
      .superRefine((forms, context) => uniqueBy(forms, context, "key", "This style is already in the list.")),
    leathers: z.array(z.enum(colorKeys, "Please pick a leather.")).min(1, "Keep at least one leather.").max(7, "There is room for 7 leathers."),
    fallbackImage: image,
    fallbackAlt: text(200),
  }).superRefine((hero, context) => {
    const repeated = hero.leathers.findIndex((color, index) => hero.leathers.indexOf(color) !== index);
    if (repeated >= 0) context.addIssue({ code: "custom", path: ["leathers", repeated], message: "This leather is already in the list." });
  }),
  categories: z.strictObject({
    visible: z.boolean(),
    items: z.array(z.strictObject({ href, name: text(40), image, alt: text(200) })).max(8, "There is room for 8 tiles.").superRefine((items, context) => uniqueBy(items, context, "href", "This link is already in the list.")),
  }),
  featured: z.strictObject({ visible: z.boolean(), heading: text(60), linkLabel: text(30), linkHref: href, limit: z.number("Please enter a number.").int("Please use a whole number.").min(1, "Please show at least 1.").max(8, "There is room for 8.") }),
  studio: z.strictObject({ visible: z.boolean(), heading: text(80), body: rich(500), ctaLabel: text(40), ctaHref: href, image, imageAlt: text(200) }),
  about: z.strictObject({ visible: z.boolean(), heading: text(120), body: rich(1500) }),
  story: z.strictObject({
    visible: z.boolean(),
    preset: z.enum(presetKeys, "Please pick a style."),
    slug: text(120),
    eyebrow: text(40),
    heading: text(80),
    intro: rich(300),
    steps: z.strictObject(Object.fromEntries(STORY_STEPS.map((step) => [step, storyStep])) as Record<StoryStep, typeof storyStep>),
    endHeading: text(60),
    endBody: rich(300),
    ctaLabel: text(30),
    productLabel: text(30),
  }).default(DEFAULT_HOME.story),
  shapes: z.strictObject({ visible: z.boolean(), heading: text(60), body: rich(200), linkLabel: text(30), linkHref: href }).default(DEFAULT_HOME.shapes),
  leathers: z.strictObject({ visible: z.boolean(), eyebrow: text(40), heading: text(60), body: rich(200), ctaLabel: text(30) }).default(DEFAULT_HOME.leathers),
  making: z.strictObject({
    visible: z.boolean(),
    heading: text(80),
    steps: z.array(z.strictObject({ title: text(40), body: rich(300) })).min(1, "Keep at least one step.").max(6, "There is room for 6 steps."),
  }).default(DEFAULT_HOME.making),
  paths: z.strictObject({
    visible: z.boolean(),
    heading: text(80),
    links: z.array(z.strictObject({ label: text(30), href, note: optional(80) })).min(1, "Keep at least one link.").max(6, "There is room for 6 links.")
      .superRefine((links, context) => uniqueBy(links, context, "href", "This link is already in the list.")),
  }).default(DEFAULT_HOME.paths),
});

const navSchema = z.strictObject({
  header: z.array(z.strictObject({ label: text(30), href, menu: z.enum(["none", "women", "men", "custom"]), links: linkList(20) }))
    .min(1, "Keep at least one link.").max(8, "There is room for 8 links.")
    .superRefine((items, context) => uniqueBy(items, context, "href", "This link is already in the list.")),
  mobileLinks: linkList(12),
  footer: z.strictObject({
    columns: z.array(z.strictObject({ title: text(40), links: linkList(14) })).max(5, "There is room for 5 columns.").superRefine((columns, context) => uniqueBy(columns, context, "title", "Another column already has this title.")),
    copyright: optional(160),
  }),
});

const SEO_PATH = /^\/[\w\-/]*$/;
const seoText = (max: number) => optional(max).superRefine((value, context) => {
  const unknown = unknownTokens(value);
  if (unknown.length) context.addIssue({ code: "custom", message: "This text has a live detail we do not recognise. Delete it." });
});

const seoSchema = z.strictObject({
  siteTitle: text(120),
  siteDescription: text(320),
  organizationDescription: text(320),
  ogImage: image,
  ogImageAlt: text(200),
  pages: z.record(z.string().regex(SEO_PATH), z.strictObject({ title: seoText(120), description: seoText(320) })),
  llms: z.string().min(1, "Please fill this in.").max(20_000, "That is a little long. Keep it to 20000 characters.").regex(NO_CONTROL, "This has hidden characters in it. Please retype it.").superRefine((value, context) => {
    const unknown = unknownTokens(value);
    if (unknown.length) context.addIssue({ code: "custom", message: "This text has a live detail we do not recognise. Delete it." });
  }),
});

const days = z.number("Please enter a number of days.").int("Please use whole days.").min(0, "Please use 0 or more.").max(365, "Please use 365 or fewer.");

const deliverySchema = z.strictObject({
  makingMinDays: days.min(1, "Please use at least 1 day."),
  makingMaxDays: days.min(1, "Please use at least 1 day."),
  standardMinDays: days.min(1, "Please use at least 1 day."),
  standardMaxDays: days.min(1, "Please use at least 1 day."),
  expressMinDays: days.min(1, "Please use at least 1 day."),
  expressMaxDays: days.min(1, "Please use at least 1 day."),
  standardLabel: text(80),
  expressLabel: text(80),
}).superRefine((value, context) => {
  const fail = (path: keyof Delivery, message: string) => context.addIssue({ code: "custom", path: [path], message });
  if (value.makingMaxDays < value.makingMinDays) fail("makingMaxDays", "The longest time cannot be shorter than the shortest time.");
  if (value.standardMaxDays < value.standardMinDays) fail("standardMaxDays", "The longest time cannot be shorter than the shortest time.");
  if (value.expressMaxDays < value.expressMinDays) fail("expressMaxDays", "The longest time cannot be shorter than the shortest time.");
  if (value.standardMinDays < value.makingMinDays) fail("standardMinDays", "This time includes making the piece, so it cannot be shorter than making time.");
  if (value.standardMaxDays < value.makingMaxDays) fail("standardMaxDays", "This time includes making the piece, so it cannot be shorter than making time.");
  if (value.expressMinDays < value.makingMinDays) fail("expressMinDays", "This time includes making the piece, so it cannot be shorter than making time.");
  if (value.expressMaxDays < value.makingMaxDays) fail("expressMaxDays", "This time includes making the piece, so it cannot be shorter than making time.");
});

const cents = z.number("Please enter an amount.").int("Please use dollars and cents only.").min(0, "Please use 0 or more.").max(10_000_000, "That amount is too large.");
const centsFor = <K extends string>(record: Record<K, number>) =>
  z.strictObject(Object.fromEntries(Object.keys(record).map((key) => [key, cents])) as Record<K, typeof cents>);

const pricingSchema = z.strictObject({
  baseCents: cents,
  labourCentsPerHour: cents.min(100, "Please use at least $1.00, so a piece never costs nothing."),
  wastage: z.number("Please enter a number.").min(1, "Please use 1 or more.").max(3, "Please use 3 or less."),
  margin: z.number("Please enter a number.").min(1, "Please use 1 or more, so pieces never sell under cost.").max(10, "Please use 10 or less."),
  roundToCents: z.number("Please enter an amount.").int("Please use dollars and cents only.").min(100, "Please use at least $1.00.").max(10_000, "Please use $100.00 or less."),
  finishCentsPerDm2: centsFor(DEFAULT_PRICING.finishCentsPerDm2),
  metalCents: centsFor(DEFAULT_PRICING.metalCents),
  patternCents: centsFor(DEFAULT_PRICING.patternCents),
  zipCents: cents,
  zipPocketCents: cents,
  flapClaspCents: cents,
  handleCents: cents,
  strapCents: cents,
  feetCents: cents,
  blindMonogramCents: cents,
  foilMonogramCents: cents,
  bespokeLogoCents: cents,
  bespokeLowSpread: z.number("Please enter a number.").min(0.1, "Please use 0.10 or more.").max(1, "Please use 1 or less."),
  bespokeHighSpread: z.number("Please enter a number.").min(1, "Please use 1 or more.").max(3, "Please use 3 or less."),
  hardwareCents: centsFor(DEFAULT_PRICING.hardwareCents),
});

const bespokeSchema = z.strictObject({
  depositPercent: z.number("Please enter a percentage.").int("Please use a whole number.").min(1, "Please use 1 or more.").max(100, "Please use 100 or less."),
  quoteDays: z.number("Please enter a number of days.").int("Please use whole days.").min(1, "Please use at least 1 day.").max(365, "Please use 365 or fewer."),
});

const redirectsSchema = z.strictObject({
  rules: z.array(z.strictObject({
    source: z.string().trim().refine(isRedirectSource, "Paste the old page address, such as /old-page. The home page, the shop and sign-in pages cannot be moved."),
    destination: z.string().trim().refine(isRedirectDestination, "Pick a page on this site from the list."),
    permanent: z.boolean(),
    enabled: z.boolean(),
  })).max(500, "There is room for 500 of these.").superRefine((rules, context) => {
    uniqueBy(rules, context, "source", "This old page is already being sent somewhere.");
    rules.forEach((_, index) => {
      const problem = redirectProblem(rules, index);
      if (problem) context.addIssue({ code: "custom", path: [index, "destination"], message: problem });
    });
  }),
});

const entry = <S extends z.ZodType<T>, T>(contentSchema: S, fallback: T, label: string, preview: string) => ({ schema: contentSchema, fallback, label, preview });

export const CONTENT = {
  home: entry(homeSchema, DEFAULT_HOME, "Homepage", "/"),
  nav: entry(navSchema, DEFAULT_NAV, "Navigation", "/"),
  seo: entry(seoSchema, DEFAULT_SEO, "SEO", "/"),
  pricing: entry(pricingSchema, DEFAULT_PRICING as StudioPricing, "Studio prices", "/studio"),
  delivery: entry(deliverySchema, DEFAULT_DELIVERY as Delivery, "Delivery and making time", "/shipping-returns"),
  bespoke: entry(bespokeSchema, DEFAULT_BESPOKE, "Bespoke quotes", "/studio/create"),
  redirects: entry(redirectsSchema, DEFAULT_REDIRECTS, "Redirects", "/"),
  "page.about": entry(aboutSchema, DEFAULT_ABOUT, "About", "/about"),
  "page.faq": entry(faqSchema, DEFAULT_FAQ, "FAQ", "/faq"),
  "page.care": entry(pageSchema, DEFAULT_CARE, "Care", "/care"),
  "page.shipping-returns": entry(pageSchema, DEFAULT_SHIPPING, "Shipping and returns", "/shipping-returns"),
  "page.size-guide": entry(pageSchema, DEFAULT_SIZE_GUIDE, "Size guide", "/size-guide"),
  "page.contact": entry(contactSchema, DEFAULT_CONTACT, "Contact", "/contact"),
  "page.terms": entry(pageSchema, DEFAULT_TERMS, "Terms", "/terms"),
  "page.privacy": entry(pageSchema, DEFAULT_PRIVACY, "Privacy", "/privacy"),
};

export type ContentKey = keyof typeof CONTENT;
export type ContentValue<K extends ContentKey> = (typeof CONTENT)[K]["fallback"];

export const isContentKey = (value: string): value is ContentKey => Object.hasOwn(CONTENT, value);

function missingTable(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  return code === UNDEFINED_TABLE;
}

const storedContent = cache(async () => {
  try {
    const rows = await db.select({ key: siteContent.key, value: siteContent.value }).from(siteContent);
    return new Map(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    if (!missingTable(error)) throw error;
    console.error("[content] the site_content table is missing, showing defaults");
    return new Map<string, unknown>();
  }
});

export async function getContent<K extends ContentKey>(key: K): Promise<ContentValue<K>> {
  const stored = (await storedContent()).get(key);
  const { schema: contentSchema, fallback } = CONTENT[key];
  if (stored === undefined) return fallback;
  const parsed = contentSchema.safeParse(stored);
  if (parsed.success) return parsed.data as ContentValue<K>;
  console.error("[content] stored value failed validation, showing defaults", key);
  return fallback;
}

export async function writeContent(key: ContentKey, value: unknown, actorId: string) {
  await db
    .insert(siteContent)
    .values({ key, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: siteContent.key, set: { value, updatedBy: actorId, updatedAt: sql`now()` } });
}

export const clearContent = (key: ContentKey) => db.delete(siteContent).where(eq(siteContent.key, key));

export const listContentStatus = () =>
  db
    .select({ key: siteContent.key, updatedAt: siteContent.updatedAt, email: schema.users.email })
    .from(siteContent)
    .leftJoin(schema.users, eq(schema.users.id, siteContent.updatedBy));

export async function contentUsingMedia(path: string) {
  const rows = await db.select({ key: siteContent.key }).from(siteContent).where(sql`${siteContent.value}::text like ${`%${path}%`}`);
  return rows.map((row) => (isContentKey(row.key) ? CONTENT[row.key].label : row.key));
}

export const getDelivery = () => getContent("delivery");
export const getPricing = () => getContent("pricing");
export const getBespokeRules = () => getContent("bespoke");

export const getStudioRates = cache(async () => {
  const [pricing, delivery] = await Promise.all([getPricing(), getDelivery()]);
  return { pricing, delivery };
});

function paymentTokens(mode: PaymentMode, hasWhatsApp: boolean) {
  if (mode === "stripe") {
    return {
      payment_answer: "We take card payments through Stripe. We never see or store your full card number.",
      payment_lead: "",
      payment_privacy: "Card payments are handled by Stripe. We receive confirmation of payment, and we do not see or store your full card number.",
      payment_summary: "Card payments are handled by Stripe. OCCUIN does not see or store full card numbers.",
    };
  }
  const channel = hasWhatsApp ? "on WhatsApp" : "by email";
  return {
    payment_answer: `You do not pay on this site. Place your order and we arrange payment with you ${channel}. We start making your piece once it is paid.`,
    payment_lead: `Payment is arranged ${channel} after you order, and we start making your piece once it is paid. `,
    payment_privacy: `We do not take card payments on this site. Payment is arranged with you directly ${channel}, and we keep the phone number you give us at checkout with your order.${hasWhatsApp ? " WhatsApp handles those messages under its own terms." : ""}`,
    payment_summary: `Orders are placed on the site and payment is arranged ${channel}. The site does not take card payments.`,
  };
}

export const getTokens = cache(async (): Promise<TokenValues> => {
  const [settings, contact, delivery] = await Promise.all([getSettings(), contactDetails(), getDelivery()]);
  return {
    brand: BRAND.name,
    email: contact.email,
    whatsapp_url: contact.whatsapp ? whatsappChatUrl(contact.whatsapp, "") : "",
    making_time: makingTime(delivery),
    making_note: makingNote(delivery),
    bespoke_note: bespokeNote(delivery),
    standard_arrival: arrivalTime("standard", delivery),
    express_arrival: arrivalTime("express", delivery),
    standard_label: delivery.standardLabel,
    express_label: delivery.expressLabel,
    standard_price: money(settings.standardShippingCents),
    express_price: money(settings.expressShippingCents),
    free_shipping_note: freeShippingNote(settings),
    countries: COUNTRIES.map((country) => country.name).sort().join(", "),
    country_count: String(COUNTRIES.length),
    studio_finishes: Object.values(FINISHES).map((finish) => finish.name.toLowerCase()).join(", "),
    year: String(new Date().getFullYear()),
    ...paymentTokens(paymentModeOf(settings), Boolean(contact.whatsapp)),
  };
});

export const getAllTokens = cache(async (): Promise<TokenValues> => {
  const [tokens, cards] = await Promise.all([getTokens(), listProducts()]);
  const prices = cards.map((card) => card.priceCents);
  return { ...tokens, price_from: prices.length ? money(Math.min(...prices)) : "", price_to: prices.length ? money(Math.max(...prices)) : "" };
});

export const seoImage = cache(async () => {
  const { ogImage, ogImageAlt } = await getContent("seo");
  const size = ogImage === DEFAULT_SEO.ogImage ? DEFAULT_OG_SIZE : await storedImageSize(ogImage);
  return { url: ogImage, alt: ogImageAlt, ...size };
});

export const seoContext = cache(async (): Promise<SeoContext> => {
  const [{ pages }, image_] = await Promise.all([getContent("seo"), seoImage()]);
  const tokens = await (hasToken(JSON.stringify(pages), "price_") ? getAllTokens() : getTokens());
  return { pages, image: image_, tokens };
});

export async function pageMetadata(path: string, imageUrl?: string): Promise<Metadata> {
  await connection();
  return pageMeta(path, await seoContext(), imageUrl);
}
