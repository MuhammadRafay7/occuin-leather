import { afterEach, describe, expect, it, vi } from "vitest";
import { DEPOSIT_PERCENT } from "@/lib/bespoke/config";
import { cartTotals, discountableCents, type PricedLine } from "@/lib/cart-totals";
import { balanceBuyable, balanceCents, balanceOwedCents, depositCents, depositProblem } from "@/lib/bespoke/status";
import { whatsappChatUrl, whatsappShareUrl } from "@/lib/bespoke/whatsapp";
import { sendWhatsApp, whatsappNumber } from "@/lib/server/whatsapp";

const paidDeposit = { quotedPriceCents: 40_000, depositPercent: 50, depositPaidAt: new Date(), balancePaidAt: null, balanceRequestedAt: new Date(), status: "in_production" as const };

describe("deposit split", () => {
  it("defaults to half", () => {
    expect(DEPOSIT_PERCENT).toBe(50);
  });

  it("always adds up to the quoted price, including odd cents", () => {
    for (const [quoted, percent] of [[33_333, 33], [10_001, 50], [99_999, 7], [12_345, 100]] as const) {
      expect(depositCents(quoted, percent) + balanceCents(quoted, percent)).toBe(quoted);
    }
  });

  it("has no balance at 100 percent", () => {
    expect(balanceCents(50_000, 100)).toBe(0);
    expect(depositProblem(50_000, 100)).toBeNull();
  });

  it("rejects amounts too small to charge", () => {
    expect(depositProblem(1_000, 1)).toMatch(/deposit is too small/);
    expect(depositProblem(10_000, 99.9)).toMatch(/balance is too small/);
    expect(depositProblem(40_000, 50)).toBeNull();
  });
});

describe("balance state", () => {
  it("owes nothing until the deposit is paid", () => {
    expect(balanceOwedCents({ ...paidDeposit, depositPaidAt: null })).toBe(0);
  });

  it("owes the rest once the deposit is paid, and nothing after the balance", () => {
    expect(balanceOwedCents(paidDeposit)).toBe(20_000);
    expect(balanceOwedCents({ ...paidDeposit, balancePaidAt: new Date() })).toBe(0);
  });

  it("owes nothing on orders paid in full before deposits existed", () => {
    expect(balanceOwedCents({ ...paidDeposit, depositPaidAt: null, depositPercent: DEPOSIT_PERCENT })).toBe(0);
  });

  it("is payable only after admin requests it", () => {
    expect(balanceBuyable(paidDeposit)).toBe(true);
    expect(balanceBuyable({ ...paidDeposit, balanceRequestedAt: null })).toBe(false);
    expect(balanceBuyable({ ...paidDeposit, balancePaidAt: new Date() })).toBe(false);
    expect(balanceBuyable({ ...paidDeposit, status: "accepted" })).toBe(false);
  });

  it("stays payable on a piece delivered under an override", () => {
    expect(balanceBuyable({ ...paidDeposit, status: "completed" })).toBe(true);
  });
});

describe("promo codes on bespoke lines", () => {
  const goods: PricedLine = { amountCents: 10_000, bespoke: null };
  const deposit: PricedLine = { amountCents: 20_000, bespoke: { part: "deposit", depositCents: 20_000, balanceCents: 20_000 } };
  const balance: PricedLine = { amountCents: 20_000, bespoke: { part: "balance", depositCents: 20_000, balanceCents: 20_000 } };

  it("never discounts a deposit or balance", () => {
    expect(discountableCents([deposit, balance])).toBe(0);
    expect(cartTotals([deposit], 90).discountCents).toBe(0);
    expect(cartTotals([balance], 90).discountCents).toBe(0);
  });

  it("discounts only the goods in a mixed bag", () => {
    const totals = cartTotals([goods, deposit], 10);
    expect(totals.subtotalCents).toBe(30_000);
    expect(totals.discountCents).toBe(1_000);
  });

  it("waives shipping only when every line is a deposit with a balance to come", () => {
    expect(cartTotals([deposit], 0).shippingWaived).toBe(true);
    expect(cartTotals([goods, deposit], 0).shippingWaived).toBe(false);
    expect(cartTotals([{ ...deposit, bespoke: { part: "deposit", depositCents: 20_000, balanceCents: 0 } }], 0).shippingWaived).toBe(false);
  });

  it("counts the paid deposit towards free shipping on a balance", () => {
    expect(cartTotals([balance], 0).shippingBasisCents).toBe(40_000);
  });
});

describe("whatsapp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("escapes message text in links", () => {
    expect(whatsappChatUrl("+92 300 1234567", "a&b=c <x>")).toBe("https://wa.me/923001234567?text=a%26b%3Dc%20%3Cx%3E");
    expect(whatsappShareUrl("hello #1")).toBe("https://wa.me/?text=hello%20%231");
  });

  it("hides the number when unset or invalid", () => {
    vi.stubEnv("WHATSAPP_NUMBER", "");
    expect(whatsappNumber()).toBeNull();
    vi.stubEnv("WHATSAPP_NUMBER", "12");
    expect(whatsappNumber()).toBeNull();
    vi.stubEnv("WHATSAPP_NUMBER", "+92 300 1234567");
    expect(whatsappNumber()).toBe("923001234567");
  });

  it("sends nothing unless configured", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "");
    vi.stubEnv("WHATSAPP_PHONE_ID", "");
    const request = vi.fn();
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", request);
    expect(await sendWhatsApp({ to: "+923001234567", text: "hello" })).toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("posts to the Business API when configured", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_ID", "42");
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", request);
    expect(await sendWhatsApp({ to: "+92 300", text: "hello" })).toBe(true);
    const [url, init] = request.mock.calls[0] as [string, { body: string }];
    expect(url).toContain("/42/messages");
    expect(JSON.parse(init.body)).toMatchObject({ to: "92300", text: { body: "hello" } });
  });
});
