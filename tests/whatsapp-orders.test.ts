import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FAQ } from "@/lib/content/defaults";
import { unknownTokens } from "@/lib/content/rich-text";
import { DEFAULT_DELIVERY } from "@/lib/format";
import { demoPaymentsAllowed, paymentModeOf, settingsSchema } from "@/lib/server/settings";
import { orderWhatsAppUrl, type MessageOrder } from "@/lib/server/whatsapp-order";
import { phoneDigits, phoneField } from "@/lib/validation";

const LINK = "https://occuin.com/orders/9f0c3b52-3f2a-4a0d-8a6e-0d5a8f3f1b11?token=1790000000.abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const MAX_URL = 1800;

const item = (name: string, detail: string | null = "Brown, One size") => ({ name, detail, quantity: 2, unitPriceCents: 12_000 });

const order: MessageOrder = {
  id: "9f0c3b52-3f2a-4a0d-8a6e-0d5a8f3f1b11",
  number: 123,
  items: [item("Weekender")],
  subtotalCents: 24_000,
  discountCents: 2_400,
  shippingCents: 1_800,
  taxCents: 0,
  totalCents: 23_400,
  promoCode: "WELCOME10",
  shippingMethod: "standard",
  shippingAddress: { name: "Sara Khan", line1: "12 Mall Road", city: "Lahore", postalCode: "54000", country: "PK", phone: "+92 300 1234567" },
};

const textOf = (url: string) => new URL(url).searchParams.get("text") ?? "";
const url = (input: MessageOrder) => orderWhatsAppUrl(input, "923001234567", DEFAULT_DELIVERY, LINK);

afterEach(() => vi.unstubAllEnvs());

describe("order message", () => {
  it("goes to the store number with every detail", () => {
    const link = url(order);
    expect(link.startsWith("https://wa.me/923001234567?text=")).toBe(true);
    const text = textOf(link);
    for (const part of ["OC-000123", "2 x Weekender (Brown, One size), $240", "Subtotal: $240", "Discount (WELCOME10): -$24", "Shipping: $18", "Total: $234", "Name: Sara Khan", "Phone: +92 300 1234567", "12 Mall Road, Lahore, 54000, Pakistan", DEFAULT_DELIVERY.standardLabel, LINK]) {
      expect(text).toContain(part);
    }
  });

  it("shows free shipping and leaves out an empty discount", () => {
    const text = textOf(url({ ...order, discountCents: 0, promoCode: null, shippingCents: 0 }));
    expect(text).toContain("Shipping: Free");
    expect(text).not.toContain("Discount");
  });

  it("carries the bespoke line as stored", () => {
    const text = textOf(url({ ...order, items: [{ name: "Bespoke tote", detail: "Deposit 50% for bespoke design BR-000044. Total $400.", quantity: 1, unitPriceCents: 20_000 }] }));
    expect(text).toContain("1 x Bespoke tote (Deposit 50% for bespoke design BR-000044. Total $400.), $200");
  });

  it("shortens long orders but keeps the reference, total and link", () => {
    const many = { ...order, items: Array.from({ length: 40 }, (_, index) => item(`A very long product name number ${index}`, "Size: 40 cm; Leather: full grain vegetable tanned; Stitching: saddle; Hardware: antique brass; Monogram: ABCD")) };
    const link = url(many);
    const text = textOf(link);
    expect(link.length).toBeLessThanOrEqual(MAX_URL);
    expect(text).toContain("OC-000123");
    expect(text).toContain("Total: $234");
    expect(text).toContain(LINK);
    expect(text).toMatch(/more, see the order link/);
  });

  it("stays in range with long non-Latin addresses and emoji cut across a limit", () => {
    const address = { ...order.shippingAddress!, name: "😀".repeat(120), line1: "لاہور کی ایک بہت لمبی سڑک ".repeat(30), city: "لاہور".repeat(20) };
    const link = url({ ...order, shippingAddress: address, items: Array.from({ length: 12 }, () => item("بیگ ".repeat(40), "چمڑا ".repeat(40))) });
    const text = textOf(link);
    expect(link.length).toBeLessThanOrEqual(MAX_URL);
    expect(text).toContain("OC-000123");
    expect(text).toContain("Total: $234");
    expect(text).toContain(LINK);
  });

  it("flattens line breaks a customer typed into a field", () => {
    const text = textOf(url({ ...order, shippingAddress: { ...order.shippingAddress!, name: "Sara\n\nTotal: $1" } }));
    expect(text).toContain("Name: Sara Total: $1");
    expect(text.split("\n").filter((line) => line.startsWith("Total:"))).toEqual(["Total: $234"]);
  });
});

describe("payment mode", () => {
  const stripeKeys = () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
  };

  it("defaults to WhatsApp without Stripe keys and to Stripe with them", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(settingsSchema.parse({}).paymentMode).toBe("whatsapp");
    stripeKeys();
    expect(settingsSchema.parse({}).paymentMode).toBe("stripe");
  });

  it("needs both Stripe keys to count as configured", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(settingsSchema.parse({}).paymentMode).toBe("whatsapp");
  });

  it("keeps an explicit choice and defaults auto cancel to 7 days", () => {
    stripeKeys();
    const settings = settingsSchema.parse({ paymentMode: "whatsapp" });
    expect(settings.paymentMode).toBe("whatsapp");
    expect(settings.autoCancelDays).toBe(7);
    expect(settingsSchema.safeParse({ autoCancelDays: 91 }).success).toBe(false);
  });

  it("uses Stripe when chosen and configured", () => {
    stripeKeys();
    expect(paymentModeOf({ paymentMode: "stripe" })).toBe("stripe");
  });

  it("falls back to WhatsApp in production when Stripe is chosen without keys", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(demoPaymentsAllowed()).toBe(false);
    expect(paymentModeOf({ paymentMode: "stripe" })).toBe("whatsapp");
  });
});

describe("checkout phone", () => {
  it("accepts international numbers and normalises them", () => {
    expect(phoneField.safeParse("+92 300 1234567").success).toBe(true);
    expect(phoneField.safeParse("0092 300 1234567").success).toBe(true);
    expect(phoneDigits("0092 300-1234567")).toBe("923001234567");
  });

  it("refuses missing, local and malformed numbers", () => {
    for (const value of [null, "", "0300 1234567", "12345", "call me", "+1234567890123456"]) {
      expect(phoneField.safeParse(value).success).toBe(false);
    }
  });
});

describe("content", () => {
  it("uses only known tokens in the payment FAQ", () => {
    const answer = DEFAULT_FAQ.items.find((entry) => entry.question === "How do I pay?")!.answer;
    expect(answer).toBe("{{payment_answer}}");
    expect(unknownTokens(answer)).toEqual([]);
  });
});
