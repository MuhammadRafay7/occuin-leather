import { afterEach, describe, expect, it, vi } from "vitest";
import { csvCell, csvResponse } from "@/app/admin/_lib/csv";
import { freeShippingNote, shippingCents, type ShippingRates } from "@/lib/format";
import { newsletterText } from "@/lib/newsletter";
import { mailConfigured, sendMail } from "@/lib/server/mail";
import { settingsSchema } from "@/lib/server/settings";
import { unsubscribeOneClickUrl, unsubscribePageUrl, verifyUnsubscribe } from "@/lib/server/unsubscribe";
import { whatsappNumber } from "@/lib/server/whatsapp";

const rates: ShippingRates = { freeShippingCents: 30_000, standardShippingCents: 2_500, expressShippingCents: 4_900 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("csv cells", () => {
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\t=1", "  =1", "\n=1", "＝1"])("neutralises %j", (value) => {
    expect(csvCell(value).startsWith(`"'`)).toBe(true);
  });

  it("leaves plain text, numbers and empty values alone and doubles quotes", () => {
    expect(csvCell("a@b.co")).toBe('"a@b.co"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(null)).toBe("");
  });

  it("builds a download with no caching", async () => {
    const response = csvResponse("a.csv", ["x"], [["=1"], [2]]);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe(`"x"\r\n"'=1"\r\n2`);
  });
});

describe("shipping rates", () => {
  it("uses the given rates, not the defaults", () => {
    expect(shippingCents(29_999, "standard", rates)).toBe(2_500);
    expect(shippingCents(30_000, "standard", rates)).toBe(0);
    expect(shippingCents(30_000, "express", rates)).toBe(4_900);
  });

  it("treats a zero threshold as always free for standard only", () => {
    const free = { ...rates, freeShippingCents: 0 };
    expect(shippingCents(100, "standard", free)).toBe(0);
    expect(shippingCents(100, "express", free)).toBe(4_900);
    expect(freeShippingNote(free)).toBe("free on every order");
    expect(freeShippingNote(rates)).toBe("free over $300");
  });
});

describe("settings schema", () => {
  it("keeps today's shipping values as defaults", () => {
    expect(settingsSchema.parse({})).toMatchObject({ freeShippingCents: 20_000, standardShippingCents: 1_800, expressShippingCents: 3_800, ordersPaused: false, lowStockLimit: 5 });
  });

  it("rejects a bad email and a bad WhatsApp number", () => {
    expect(settingsSchema.safeParse({ supportEmail: "nope" }).success).toBe(false);
    expect(settingsSchema.safeParse({ whatsappNumber: "12" }).success).toBe(false);
    expect(settingsSchema.safeParse({ whatsappNumber: "call me" }).success).toBe(false);
    expect(settingsSchema.safeParse({ supportEmail: "help@occuin.com", whatsappNumber: "+92 300 1234567" }).success).toBe(true);
  });
});

describe("whatsapp number", () => {
  it("prefers the stored setting over the environment", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "+1 202 555 0100");
    expect(whatsappNumber("+92 300 1234567")).toBe("923001234567");
    expect(whatsappNumber("")).toBe("12025550100");
  });
});

describe("unsubscribe links", () => {
  const stub = () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "x".repeat(32));
    vi.stubEnv("APP_URL", "https://occuin.test");
  };
  const tokenIn = (url: string) => new URL(url).searchParams.get("token")!;

  it("accepts its own signature and is case blind on the address", () => {
    stub();
    const token = tokenIn(unsubscribePageUrl("a+b@c.co"));
    expect(new URL(unsubscribePageUrl("a+b@c.co")).searchParams.get("email")).toBe("a+b@c.co");
    expect(verifyUnsubscribe("a+b@c.co", token)).toBe(true);
    expect(verifyUnsubscribe("A+B@C.CO", token)).toBe(true);
  });

  it("refuses a token for another address, a forged token and a token signed with another secret", () => {
    stub();
    const token = tokenIn(unsubscribeOneClickUrl("a@c.co"));
    expect(verifyUnsubscribe("b@c.co", token)).toBe(false);
    expect(verifyUnsubscribe("a@c.co", "AAAA")).toBe(false);
    expect(verifyUnsubscribe("a@c.co", "")).toBe(false);
    vi.stubEnv("LINK_SIGNING_SECRET", "y".repeat(32));
    expect(verifyUnsubscribe("a@c.co", token)).toBe(false);
  });

  it("puts the link at the end of every message", () => {
    expect(newsletterText("  Hello \n", "https://x/u")).toContain("Hello\n\n--\n");
    expect(newsletterText("Hello", "https://x/u")).toContain("Unsubscribe: https://x/u");
  });
});

describe("mail", () => {
  it("says not configured without both the key and the sender", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "a@b.co");
    expect(mailConfigured()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("MAIL_FROM", "");
    expect(mailConfigured()).toBe(false);
    vi.stubEnv("MAIL_FROM", "a@b.co");
    expect(mailConfigured()).toBe(true);
  });

  it("sends reply-to and headers in the provider's format", async () => {
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("MAIL_FROM", "a@b.co");
    const post = vi.fn(async (_url: string, _init: { body: string }) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", post);
    expect(await sendMail({ to: "c@d.co", subject: "S", text: "T", replyTo: "r@d.co", headers: { "List-Unsubscribe": "<u>" } })).toBe(true);
    expect(JSON.parse(post.mock.calls[0]![1].body)).toEqual({ from: "a@b.co", to: "c@d.co", subject: "S", text: "T", reply_to: "r@d.co", headers: { "List-Unsubscribe": "<u>" } });
  });
});
