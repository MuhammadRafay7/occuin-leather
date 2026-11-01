import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/lib/bespoke/design";
import { MAX_REQUEST_BYTES } from "@/lib/bespoke/submission";
import { publicName } from "@/lib/format";
import { ipBucket } from "@/lib/server/client-ip";
import { linkKey } from "@/lib/server/link-key";
import { sendMail } from "@/lib/server/mail";

const SRC = resolve("src");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
});
const resolveImport = (from: string, target: string) => {
  const base = target.startsWith("@/") ? join(SRC, target.slice(2)) : target.startsWith(".") ? resolve(dirname(from), target) : null;
  if (!base) return null;
  return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((path) => { try { return statSync(path).isFile(); } catch { return false; } }) ?? null;
};
const valueImports = (file: string) => [...readFileSync(file, "utf8").matchAll(/^(?!import type)(?:import|export) [^;]*?from "([^"]+)"/gm)].map((match) => match[1]!);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("mail", () => {
  it("never logs message text in production without a key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendMail({ to: "a@b.co", subject: "Reset", text: "secret-link" })).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });
});

describe("link signing key", () => {
  it("uses the dedicated secret, unrelated to the database url", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "x".repeat(32));
    vi.stubEnv("DATABASE_URL", "postgres://one");
    const first = linkKey("order-link");
    vi.stubEnv("DATABASE_URL", "postgres://two");
    expect(linkKey("order-link").equals(first)).toBe(true);
    expect(linkKey("bespoke-quote-share").equals(first)).toBe(false);
  });

  it("falls back to the database url when the secret is short", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "short");
    vi.stubEnv("DATABASE_URL", "postgres://one");
    const first = linkKey("order-link");
    vi.stubEnv("DATABASE_URL", "postgres://two");
    expect(linkKey("order-link").equals(first)).toBe(false);
  });

  it("refuses to sign with no key material", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "");
    vi.stubEnv("DATABASE_URL", "");
    delete process.env.DATABASE_URL;
    expect(() => linkKey("order-link")).toThrow();
  });
});

describe("rate limit address bucket", () => {
  it("groups an IPv6 /64 and leaves IPv4 alone", () => {
    expect(ipBucket("2001:db8:1:2:aaaa::1")).toBe(ipBucket("2001:DB8:1:2:bbbb:cccc:dddd:eeee"));
    expect(ipBucket("2001:db8:1:3::1")).not.toBe(ipBucket("2001:db8:1:2::1"));
    expect(ipBucket("::1")).toBe("0000:0000:0000:0000::/64");
    expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("unknown")).toBe("unknown");
  });
});

describe("public review names", () => {
  it("shows a first name and initial only", () => {
    expect(publicName("Ayesha Khan")).toBe("Ayesha K.");
    expect(publicName("  Sara  van  dyke ")).toBe("Sara D.");
    expect(publicName("Madonna")).toBe("Madonna");
  });
});

describe("upload limits", () => {
  it("keeps a full bespoke request under the platform body limit", () => {
    expect(MAX_REQUEST_BYTES).toBeLessThan(4_500_000);
    expect(LIMITS.imagesTotalBytes).toBeLessThan(MAX_REQUEST_BYTES);
  });
});

describe("client bundle boundary", () => {
  it("does not reach server modules from any client component", () => {
    const clients = walk(SRC).filter((file) => /^["']use client["']/.test(readFileSync(file, "utf8").trimStart()));
    expect(clients.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    const queue = [...clients];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file) || /^\s*["']use server["']/.test(readFileSync(file, "utf8"))) continue;
      seen.add(file);
      for (const target of valueImports(file)) {
        expect(target, file).not.toMatch(/^(pg|sharp|stripe|drizzle-orm|@node-rs\/argon2)$/);
        const path = resolveImport(file, target);
        if (path) queue.push(path);
      }
    }
    expect([...seen].filter((file) => file.includes(join("src", "lib", "server")))).toEqual([]);
  });
});
