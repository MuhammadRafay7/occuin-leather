import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CSV_COLUMNS, planImport, repricedCents, type Catalog } from "@/lib/catalog-import";
import { csvCell, csvLine, neutraliseCell, parseCsv, restoreCell } from "@/lib/csv";
import { IMAGE_PATH, mediaIdOf, safeFilename } from "@/lib/media";
import { encodeMedia } from "@/lib/server/media";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

const catalog = (): Catalog => ({
  categories: ["leather-totes"],
  mediaIds: [MEDIA_ID],
  products: [{ id: PRODUCT_ID, slug: "cabas", name: "Cabas", description: "A tote.", composition: "Leather", categorySlug: "leather-totes", images: ["/images/a.webp"], audiences: ["women"], featured: false, active: true }],
  variants: [
    { id: "v1", productId: PRODUCT_ID, sku: "CAB-1", color: "Cognac", size: "One", priceCents: 10000, stock: 3 },
    { id: "v2", productId: "other", sku: "OTHER-1", color: "Black", size: "One", priceCents: 10000, stock: 1 },
  ],
});

const row = (overrides: Partial<Record<(typeof CSV_COLUMNS)[number], string>> = {}) => {
  const base: Record<string, string> = { product_slug: "cabas", product_name: "Cabas", description: "A tote.", composition: "Leather", category_slug: "leather-totes", images: "/images/a.webp", audiences: "women", featured: "false", active: "true", sku: "CAB-1", color: "Cognac", size: "One", price: "100.00", stock: "3", ...overrides };
  return csvLine(CSV_COLUMNS.map((column) => base[column]!));
};
const file = (...rows: string[]) => [csvLine([...CSV_COLUMNS]), ...rows].join("\r\n");

describe("csv", () => {
  it("parses quotes, commas, doubled quotes, embedded newlines and a BOM", () => {
    const { records } = parseCsv('﻿a,b\r\n"x, y","say ""hi""\nthere"\n\nlast,row');
    expect(records.map((record) => record.cells)).toEqual([["a", "b"], ["x, y", 'say "hi"\nthere'], ["last", "row"]]);
    expect(records.map((record) => record.line)).toEqual([1, 2, 5]);
  });

  it("reports a quote that never closes", () => {
    expect(parseCsv('a,"b').error).toMatch(/never closes/);
  });

  it.each(["=1+1", "+cmd", "-2", "@sum", "\tx", "\rx", " =1", "'=1"])("neutralises %j and restores it", (value) => {
    expect(neutraliseCell(value).startsWith("'")).toBe(true);
    expect(restoreCell(neutraliseCell(value))).toBe(value);
  });

  it("leaves ordinary text alone", () => {
    expect(neutraliseCell("Cognac tote")).toBe("Cognac tote");
    expect(restoreCell("'quoted'")).toBe("'quoted'");
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});

describe("media paths", () => {
  it("accepts public images and media routes and refuses anything else", () => {
    expect(IMAGE_PATH.test("/images/studio/tote.webp")).toBe(true);
    expect(IMAGE_PATH.test(`/api/media/${MEDIA_ID}`)).toBe(true);
    for (const path of ["/images/../secret", "/api/media/1", `/api/media/${MEDIA_ID}/x`, "https://x.test/a.png", "/api/designs/a"]) expect(IMAGE_PATH.test(path)).toBe(false);
    expect(mediaIdOf(`/api/media/${MEDIA_ID}`)).toBe(MEDIA_ID);
    expect(mediaIdOf("/images/a.webp")).toBeNull();
  });

  it("makes filenames safe", () => {
    expect(safeFilename("../../Évening Bag (final)!.JPG")).toBe("evening-bag-final.webp");
    expect(safeFilename('"><script>.png')).toBe("script.webp");
    expect(safeFilename("...")).toBe("image.webp");
  });
});

describe("media encoding", () => {
  const png = () => sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#884422" } }).withExif({ IFD0: { Copyright: "secret" } }).png().toBuffer();

  it("re-encodes to capped webp without metadata", async () => {
    const encoded = await encodeMedia(await png());
    if ("error" in encoded) throw new Error(encoded.error);
    expect([encoded.width, encoded.height]).toEqual([2400, 1200]);
    const meta = await sharp(encoded.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
  });

  it("refuses files that only claim to be images", async () => {
    expect(await encodeMedia(Buffer.from("<svg onload=alert(1)>"))).toHaveProperty("error");
    const truncated = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    expect(await encodeMedia(truncated)).toHaveProperty("error");
  });
});

describe("import planning", () => {
  it("finds nothing to do when the file matches", () => {
    const plan = planImport(file(row()), catalog());
    expect(plan).toMatchObject({ issues: [], products: [], variants: [], unchanged: 2 });
  });

  it("plans updates, new products and new variants", () => {
    const plan = planImport(file(row({ price: "120", stock: "5", product_name: "Cabas 38" }), row({ sku: "CAB-2", size: "Large", product_name: "Cabas 38" }), row({ product_slug: "new-bag", sku: "NEW-1" })), catalog());
    expect(plan.issues).toEqual([]);
    expect(plan.products.map((op) => [op.slug, Boolean(op.id)])).toEqual([["cabas", true], ["new-bag", false]]);
    const updated = plan.variants.find((op) => op.values.sku === "CAB-1")!;
    expect(updated.previousStock).toBe(3);
    expect(updated.changes).toEqual(["Price: 100.00 to 120.00", "Stock: 3 to 5"]);
    expect(plan.variants.filter((op) => !op.id).map((op) => op.values.sku)).toEqual(["CAB-2", "NEW-1"]);
  });

  it("validates every row and reports the line", () => {
    const plan = planImport(file(row({ price: "free" }), row({ sku: "A B", size: "L" }), row({ sku: "OTHER-1", size: "M" }), row({ product_slug: "x", sku: "X-1", category_slug: "nope", images: "/etc/passwd" }), row({ product_slug: "y", sku: "Y-1", images: `/api/media/${"3".repeat(8)}-3333-4333-8333-${"3".repeat(12)}` })), catalog());
    expect(plan.issues).toEqual([
      { line: 2, message: "Enter a price such as 1250 or 1250.50." },
      { line: 3, message: "A SKU cannot contain spaces." },
      { line: 4, message: "SKU OTHER-1 already belongs to another product." },
      { line: 5, message: "Each image must be an uploaded image or a path under /images." },
      { line: 6, message: expect.stringContaining("not in the media library") },
    ]);
  });

  it("refuses duplicates and rows that disagree about a product", () => {
    const plan = planImport(file(row(), row({ sku: "CAB-1", size: "L" }), row({ sku: "CAB-3" }), row({ sku: "CAB-4", size: "XL", product_name: "Other" })), catalog());
    expect(plan.issues.map((issue) => issue.line)).toEqual([3, 4, 5]);
    expect(plan.issues[0]!.message).toMatch(/more than once/);
    expect(plan.issues[1]!.message).toMatch(/listed twice/);
    expect(plan.issues[2]!.message).toMatch(/different product_name/);
  });

  it("restores neutralised text from an export", () => {
    const plan = planImport(file(row({ product_slug: "dash", sku: "D-1", description: "- a dash" })), catalog());
    expect(plan.products[0]!.values.description).toBe("- a dash");
  });

  it("rejects bad headers", () => {
    expect(planImport("a,b\n1,2", catalog()).issues[0]!.message).toMatch(/Missing columns/);
    expect(planImport("", catalog()).issues[0]!.message).toMatch(/empty/);
  });
});

describe("price change", () => {
  it("rounds to the cent", () => {
    expect(repricedCents(10000, 10)).toBe(11000);
    expect(repricedCents(125050, -7.5)).toBe(115671);
    expect(repricedCents(1999, 12.5)).toBe(2249);
  });
});
