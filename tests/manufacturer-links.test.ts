import { beforeAll, describe, expect, it } from "vitest";

const ORDER = "6f1c1c7e-2b1e-4d6c-9a43-6d0d3f0a1b11";
const OTHER_ORDER = "7f1c1c7e-2b1e-4d6c-9a43-6d0d3f0a1b12";
const LINK = "8f1c1c7e-2b1e-4d6c-9a43-6d0d3f0a1b13";

describe("manufacturer link tokens", () => {
  let tokens: typeof import("@/lib/server/manufacturer-token");
  beforeAll(async () => {
    process.env.LINK_SIGNING_SECRET = "a-test-secret-of-at-least-thirty-two-chars";
    tokens = await import("@/lib/server/manufacturer-token");
  });
  const future = new Date(Date.now() + 86_400_000);
  const link = { id: LINK, orderId: ORDER, expiresAt: future };

  it("round trips one order and one link", () => {
    expect(tokens.readToken(tokens.signLink(link))).toEqual({ orderId: ORDER, linkId: LINK });
  });

  it("refuses a token moved to another order", () => {
    const parts = tokens.signLink(link).split(".");
    const other = tokens.signLink({ ...link, orderId: OTHER_ORDER }).split(".");
    expect(tokens.readToken([other[0], parts[1], parts[2], parts[3]].join("."))).toBeNull();
  });

  it("refuses an extended expiry and a tampered signature", () => {
    const parts = tokens.signLink(link).split(".");
    const later = Math.floor(Date.now() / 1000 + 9e7).toString(36);
    expect(tokens.readToken([parts[0], parts[1], later, parts[3]].join("."))).toBeNull();
    expect(tokens.readToken([parts[0], parts[1], parts[2], `${parts[3]!.slice(0, -2)}AA`].join("."))).toBeNull();
    expect(tokens.readToken("nonsense")).toBeNull();
    expect(tokens.readToken("a.b.c.d")).toBeNull();
  });

  it("refuses an expired token", () => {
    const expired = tokens.signLink({ ...link, expiresAt: new Date(Date.now() - 1000) });
    expect(tokens.readToken(expired)).toBeNull();
  });

  it("depends on the signing secret", () => {
    const token = tokens.signLink(link);
    process.env.LINK_SIGNING_SECRET = "another-test-secret-of-at-least-thirty-two";
    expect(tokens.readToken(token)).toBeNull();
    process.env.LINK_SIGNING_SECRET = "a-test-secret-of-at-least-thirty-two-chars";
  });

  it("caps uploaded images and refuses other data", () => {
    expect(tokens.decodeShot("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(tokens.decodeShot(`data:image/jpeg;base64,${"A".repeat(3_400_000)}`)).toBeNull();
    expect(tokens.decodeShot("data:image/jpeg;base64,%%%")).toBeNull();
    expect(tokens.decodeShot("data:image/jpeg;base64,/9j/4AAQ")).toBeInstanceOf(Buffer);
  });

  it("writes a WhatsApp message with the link and no customer details", () => {
    const text = tokens.shareMessage("OC-000042", "https://occuin.com/manufacturer/abc", new Date("2026-05-01T00:00:00Z"));
    expect(text).toContain("OC-000042");
    expect(text).toContain("https://occuin.com/manufacturer/abc");
    expect(text).toContain("2026-05-01");
  });
});
