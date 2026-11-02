import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSafeHref, isSitePath } from "@/lib/content/rich-text";
import { isRedirectDestination, redirectProblem, usableRules } from "@/lib/redirects";

const database = vi.hoisted(() => ({
  rows: [] as unknown[][],
  writes: [] as unknown[],
  executed: [] as unknown[],
}));

vi.mock("@/lib/server/db", async () => {
  const schema = await import("@/lib/server/schema");
  const chain = (): unknown =>
    new Proxy(function () {}, {
      get(_target, property) {
        if (property === "then") return (resolve: (rows: unknown[]) => void) => resolve(database.rows.shift() ?? []);
        return chain;
      },
      apply: () => chain(),
    });
  const write = (kind: string) => () => {
    const step = (): unknown =>
      new Proxy(function () {}, {
        get(_target, property) {
          if (property === "then") return (resolve: (rows: unknown[]) => void) => resolve(database.rows.shift() ?? []);
          return (value: unknown) => {
            if (property === "set" || property === "values") database.writes.push({ kind, value });
            return step();
          };
        },
      });
    return step();
  };
  const client = { select: chain, insert: write("insert"), update: write("update"), delete: write("delete"), execute: async (query: unknown) => void database.executed.push(query) };
  return { db: { ...client, transaction: (task: (tx: typeof client) => unknown) => task(client) }, schema, closeDb: async () => {} };
});

beforeEach(() => {
  database.rows = [];
  database.writes = [];
  database.executed = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const rule = (source: string, destination: string, enabled = true) => ({ source, destination, permanent: false, enabled });

describe("paths that resolve off site", () => {
  it.each(["/.//evil.test", "/x/..//evil.test", "/././/evil.test", "/a/b/../..//evil.test/"])("refuses %s", (path) => {
    expect(isSitePath(path)).toBe(false);
    expect(isSafeHref(path)).toBe(false);
    expect(isRedirectDestination(path)).toBe(false);
  });

  it("keeps ordinary paths", () => {
    for (const path of ["/shop", "/a/./b", "/a/../b", "/sec//y", "/shop/leather?sort=new#top"]) expect(isSitePath(path)).toBe(true);
  });

  it("drops a stored off-site destination at the proxy", () => {
    expect(usableRules([rule("/old", "/.//evil.test")]).size).toBe(0);
  });
});

describe("redirect loops", () => {
  it.each([
    ["/a", "/./a"],
    ["/a", "/x/../a"],
    ["/a", "/x/../a/"],
    ["/a%20b", "/a b"],
    ["/x/y", "/x//y"],
    ["/shop/leather", "/shop"],
    ["/shop/leather", "/shop?sort=new"],
  ])("catches %s to %s", (source, destination) => {
    expect(redirectProblem([rule(source, destination)], 0)).toEqual(expect.any(String));
  });

  it("follows a chain through a normalised path", () => {
    expect(redirectProblem([rule("/a", "/b"), rule("/b", "/x/../a")], 0)).toEqual(expect.any(String));
  });

  it("leaves unrelated rules alone", () => {
    expect(redirectProblem([rule("/old", "/shop")], 0)).toBeNull();
    expect(redirectProblem([rule("/old", "/./new")], 0)).toBeNull();
  });

  it("does not throw on a value the schema is about to refuse", () => {
    expect(() => redirectProblem([rule("/a", "http://[")], 0)).not.toThrow();
  });
});

describe("redirect table in the proxy", () => {
  const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;
  const visit = async (path = "/some-page") => {
    const { proxy } = await import("@/proxy");
    return proxy(new NextRequest(`http://localhost:3000${path}`), event);
  };

  it("reads the rules once for many requests", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const load = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", load);
    for (let request = 0; request < 25; request++) await visit();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not reload on every request after a failed load", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", load);
    for (let request = 0; request < 25; request++) await visit();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after the retry window", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", load);
    await visit();
    const later = Date.now() + 11_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    await visit();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("serves a redirect without touching the network again", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const load = vi.fn(async () => Response.json([rule("/old", "/about")]));
    vi.stubGlobal("fetch", load);
    const response = await visit("/old");
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location")!, "http://localhost:3000").pathname).toBe("/about");
    await visit("/old");
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("marking an order paid", () => {
  it("reports a refusal when the order is not awaiting payment", async () => {
    const { moveOrder } = await import("@/lib/server/orders");
    expect(await moveOrder("order", "paid")).toEqual({ error: expect.any(String) });
  });

  it("succeeds when the order moved", async () => {
    const { moveOrder } = await import("@/lib/server/orders");
    database.rows = [[{ id: "order", ownerKey: "g:x", email: null, promoCode: null }]];
    expect(await moveOrder("order", "paid")).toEqual({ ok: true });
  });
});

describe("a Stripe payment on an order staff already marked paid", () => {
  const session = { id: "cs_1", payment_intent: "pi_1", amount_total: 1000, currency: "usd" };

  it("keeps the payment intent so the order can be refunded", async () => {
    const { settleCheckoutSession } = await import("@/lib/server/orders");
    const paid = { id: "order", status: "paid", totalCents: 1000, currency: "usd", stripePaymentIntentId: null };
    database.rows = [[paid], [], [paid]];
    await settleCheckoutSession(session as never);
    expect(database.writes).toContainEqual({ kind: "update", value: { stripePaymentIntentId: "pi_1" } });
  });
});

describe("starting a newsletter campaign", () => {
  const input = { subject: "s", body: "b", total: 1, actorEmail: "a@example.test" };

  it("takes a lock before checking for an active campaign", async () => {
    const { createCampaign } = await import("@/lib/server/campaigns");
    database.rows = [[{ total: 0 }]];
    expect(await createCampaign(input)).toMatchObject({ subject: "s", status: "sending" });
    expect(database.executed).toHaveLength(1);
    expect(database.writes).toHaveLength(1);
  });

  it("refuses while another campaign is sending", async () => {
    const { createCampaign } = await import("@/lib/server/campaigns");
    database.rows = [[{ total: 1 }]];
    expect(await createCampaign(input)).toBeNull();
    expect(database.writes).toHaveLength(0);
  });
});
