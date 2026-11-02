import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import { BRAND, FREE_SHIPPING_CENTS, ORDERS_PAUSED_FALLBACK, SHIPPING_METHODS } from "../format";
import { db, schema } from "./db";
import { whatsappNumber } from "./whatsapp";

const STORE_KEY = "store";

export const PAYMENT_MODES = ["whatsapp", "stripe"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
export const demoPaymentsAllowed = () => process.env.ALLOW_DEMO_PAYMENTS === "true" && process.env.NODE_ENV !== "production";

export const settingsSchema = z.object({
  announcement: z.string().trim().max(160).default(""),
  freeShippingCents: z.number().int().min(0).max(100_000_000).default(FREE_SHIPPING_CENTS),
  standardShippingCents: z.number().int().min(0).max(10_000_000).default(SHIPPING_METHODS.standard.cents),
  expressShippingCents: z.number().int().min(0).max(10_000_000).default(SHIPPING_METHODS.express.cents),
  ordersPaused: z.boolean().default(false),
  ordersPausedMessage: z.string().trim().max(200).default(""),
  lowStockLimit: z.number().int().min(0).max(1000).default(5),
  supportEmail: z.string().trim().max(200).pipe(z.union([z.literal(""), z.email("Enter a valid email address.")])).default(""),
  whatsappNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^$|^\+?[\d\s()-]+$/, "Use digits in international format, such as +92 300 1234567.")
    .refine((value) => !value || /^\d{7,15}$/.test(value.replace(/\D/g, "")), "Enter 7 to 15 digits, including the country code.")
    .default(""),
  paymentMode: z.enum(PAYMENT_MODES).default(() => (stripeConfigured() ? "stripe" : "whatsapp")),
  autoCancelDays: z.number().int().min(0).max(90, "Enter a whole number from 0 to 90.").default(7),
});

export type StoreSettings = z.infer<typeof settingsSchema>;

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const [row] = await db.select({ value: schema.siteSettings.value }).from(schema.siteSettings).where(eq(schema.siteSettings.key, STORE_KEY));
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : settingsSchema.parse({});
});

export const contactDetails = async () => {
  const { supportEmail, whatsappNumber: stored } = await getSettings();
  return { email: supportEmail || BRAND.email, whatsapp: whatsappNumber(stored) };
};

export const paymentModeOf = (settings: Pick<StoreSettings, "paymentMode">): PaymentMode =>
  settings.paymentMode === "stripe" && (stripeConfigured() || demoPaymentsAllowed()) ? "stripe" : "whatsapp";

export const pausedMessage = (settings: StoreSettings) => (settings.ordersPaused ? settings.ordersPausedMessage || ORDERS_PAUSED_FALLBACK : null);

export async function saveSettings(value: StoreSettings) {
  await db
    .insert(schema.siteSettings)
    .values({ key: STORE_KEY, value })
    .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value, updatedAt: sql`now()` } });
}
