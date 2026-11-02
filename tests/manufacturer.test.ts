import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankDesign, designSchema, type BespokeDesign } from "@/lib/bespoke/design";
import { PdfDocument } from "@/lib/bespoke/pdf";
import { sheetDocument } from "@/lib/manufacturer/html";
import { pdfText, sheetPdf, wrapText } from "@/lib/manufacturer/pdf";
import { bespokeSections } from "@/lib/manufacturer/bespoke-rows";
import { productSections } from "@/lib/manufacturer/product-rows";
import { inches, leafPaths, length, OTHER_SECTION, unrepresentedPaths, type SheetSection } from "@/lib/manufacturer/rows";
import { buildSheet, requiredByDate, type SheetFile, type SheetItem, type SheetOrder } from "@/lib/manufacturer/sheet";
import { bespokeSnapshotOf, productSnapshotOf, type BespokeSnapshot } from "@/lib/manufacturer/snapshot";
import { studioSections } from "@/lib/manufacturer/studio-rows";
import { SHEET_VIEW_KEYS, SHEET_VIEWS } from "@/lib/manufacturer/views";
import { PRESETS } from "@/lib/studio/presets";
import { designSpecSchema, type DesignSpec } from "@/lib/studio/spec";

const FULL_SPEC: DesignSpec = {
  ...PRESETS.weekender,
  panels: { ...PRESETS.weekender.panels, layout: "yoke", divide: 0.62 },
  surface: { pattern: "quilted", scale: 1.2 },
  closure: { type: "flap", flapShape: "round", flapLength: 0.6, clasp: "turnlock" },
  carry: { handles: 2, handleDrop: 200, handleWidth: 22, strap: true, strapLength: 1250, strapWidth: 38 },
  monogram: { text: "a&b", font: "script", technique: "gold", placement: "flap" },
  pocket: "zip",
};

const point = (x: number, y: number) => ({ x, y, smooth: false });
const panel = (id: string, name: string): BespokeDesign["pieces"][number] =>
  designSchema.shape.pieces.element.parse({
    id, name, points: [point(-100, -80), point(100, -80), point(100, 80), point(-100, 80)], closed: true, mirror: false, visible: true, finish: "box", color: "cognac", thread: "honey", stitched: true, stack: 0, text: null,
  });

const FULL_DESIGN: BespokeDesign = {
  ...blankDesign(),
  name: "Atelier <b>tote</b>",
  depth: 80,
  closure: "Magnetic <flap>",
  notes: "Line it (please) & keep it soft",
  bodyId: "body",
  pieces: [
    {
      ...panel("body", "Body"),
      hardware: [{ id: "h1", kind: "zip", x: 0, y: -60, rotation: 15, length: 180, shape: "plain", label: "Top zip" }, { id: "h2", kind: "turnlock", x: 5, y: 40, rotation: 0, length: 20, shape: "round", label: "" }],
      text: { value: "A.K. 1999", technique: "gold", font: "didone" },
      textPlace: "corner",
      logo: { id: "2f3f5a0e-5a7d-4f53-8a8e-1b7f35c5f111", x: 10, y: 20, width: 45, rotation: 12, style: "foil", rightsConfirmed: true },
      fold: { ax: -100, ay: 0, bx: 100, by: 0, angle: 45 },
      puff: 6,
    },
    { ...panel("hole", "Window"), holeOf: "body", points: [point(-20, -20), point(20, -20), point(20, 20), point(-20, 20)] },
    { ...panel("strap", "Strap"), kind: "tube", closed: false, points: [point(-80, -120), point(0, -160), point(80, -120)], tubeWidth: 18, tubeStyle: "chain", rings: true },
  ],
};

const SNAPSHOT: BespokeSnapshot = bespokeSnapshotOf({ id: "req", productType: "bag", notes: "Request <note> & more", design: designSchema.parse(FULL_DESIGN) }, "BR-000123", new Date("2026-01-01T00:00:00Z"));

const PRODUCT = productSnapshotOf(
  { id: "p1", slug: "cabas-38", name: "Cabas 38", description: "Soft everyday tote.", composition: "100% calf leather. Made in Pakistan.", categorySlug: "tote-bags", images: ["/images/a.jpg", "/images/b.jpg"], studioPreset: PRESETS.tote },
  { sku: "CAB-38-COG", color: "Cognac", size: "One size" },
  new Date("2026-01-01T00:00:00Z"),
);

const baseOrder = (items: SheetItem[], status = "paid"): SheetOrder => ({
  id: "11111111-1111-4111-8111-111111111111",
  number: 42,
  status,
  createdAt: new Date("2026-03-01T10:00:00Z"),
  paidAt: new Date("2026-03-02T10:00:00Z"),
  makingDays: 30,
  shippingAddress: { name: "Jane Secret", line1: "1 Hidden Road", city: "Lahore", postalCode: "54000", country: "PK", phone: "+923001234567" } as SheetOrder["shippingAddress"],
  items,
});

const studioItem: SheetItem = { id: "a", name: "Grand Tour", quantity: 2, designSpec: FULL_SPEC, productSnapshot: null, bespokeSnapshot: null, bespokePart: null };
const bespokeItem: SheetItem = { id: "b", name: "Atelier tote", quantity: 1, designSpec: null, productSnapshot: null, bespokeSnapshot: SNAPSHOT, bespokePart: "deposit" };
const productItem: SheetItem = { id: "c", name: "Cabas 38", quantity: 1, designSpec: null, productSnapshot: PRODUCT, bespokeSnapshot: null, bespokePart: null };
const balanceItem: SheetItem = { id: "d", name: "Atelier tote", quantity: 1, designSpec: null, productSnapshot: null, bespokeSnapshot: null, bespokePart: "balance" };

const URLS = { file: (id: string) => `/f/${id}`, download: (path: string) => `/d/${path}`, pdf: "/pdf" };
const flatten = (sections: SheetSection[]) => sections.flatMap((section) => section.rows.map((row) => `${section.title}|${row.label}|${row.value}`)).join("\n");

type Node = { def?: { type?: string }; shape?: Record<string, Node>; element?: Node; unwrap?: () => Node; options?: unknown[] };

function schemaLeaves(node: Node, prefix = ""): { path: string; node: Node }[] {
  if (node.shape) return Object.entries(node.shape).flatMap(([key, child]) => schemaLeaves(child, prefix ? `${prefix}.${key}` : key));
  if (node.element) return schemaLeaves(node.element, `${prefix}.0`);
  if (node.unwrap) return schemaLeaves(node.unwrap(), prefix);
  return [{ path: prefix, node }];
}

const setPath = (source: unknown, path: string, value: unknown) => {
  const clone = structuredClone(source) as Record<string, unknown>;
  const keys = path.split(".");
  let at: Record<string, unknown> = clone;
  for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>;
  at[keys.at(-1)!] = value;
  return clone;
};

const getPath = (source: unknown, path: string) => path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], source);

const changed = (value: unknown, options?: unknown[]) => {
  if (options?.length) return options.find((option) => option !== value);
  if (typeof value === "number") return value + 0.37;
  if (typeof value === "boolean") return !value;
  return `${String(value)}X`;
};

describe("every studio field is on the sheet", () => {
  it.each(Object.entries(PRESETS))("%s has no unrepresented field", (_, spec) => {
    const sections = studioSections(spec);
    expect(unrepresentedPaths(spec, sections)).toEqual([]);
    expect(sections.some((section) => section.title === OTHER_SECTION)).toBe(false);
  });

  it("covers every leaf the schema allows", () => {
    const leaves = schemaLeaves(designSpecSchema as unknown as Node).map((leaf) => leaf.path);
    expect(leaves.length).toBeGreaterThan(30);
    expect(leaves.sort()).toEqual(leafPaths(FULL_SPEC).sort());
    expect(unrepresentedPaths(FULL_SPEC, studioSections(FULL_SPEC))).toEqual([]);
  });

  it("changes the printed sheet when any single field changes", () => {
    const before = flatten(studioSections(FULL_SPEC));
    const silent = schemaLeaves(designSpecSchema as unknown as Node).filter(({ path, node }) => {
      if (path === "version") return false;
      const value = getPath(FULL_SPEC, path);
      return flatten(studioSections(setPath(FULL_SPEC, path, changed(value, node.options)) as DesignSpec)) === before;
    });
    expect(silent.map((leaf) => leaf.path)).toEqual([]);
  });

  it("puts an unknown future field in a visible section instead of dropping it", () => {
    const future = { ...FULL_SPEC, trim: { colour: "brass" } } as unknown as DesignSpec;
    const sections = studioSections(future);
    const other = sections.find((section) => section.title === OTHER_SECTION);
    expect(other?.rows.map((row) => [row.label, row.value])).toEqual([["trim.colour", "brass"]]);
  });

  it("shows each dimension in millimetres and inches", () => {
    const text = flatten(studioSections(PRESETS.tote));
    for (const mm of [380, 300, 150]) expect(text).toContain(`${mm} mm (${inches(mm)})`);
    expect(length(254)).toBe("254 mm (10.00 in)");
  });

  it("gives exact monogram wording, font, technique, size and position", () => {
    const text = flatten(studioSections(FULL_SPEC));
    expect(text).toContain('A&B (typed by the customer as "a&b")');
    expect(text).toContain("Script, Pinyon Script");
    expect(text).toContain("Gold foil");
    expect(text).toContain("On the flap");
    expect(text).toContain("font size");
  });
});

describe("every bespoke field is on the sheet", () => {
  it("has no unrepresented field", () => {
    expect(unrepresentedPaths(SNAPSHOT.design, bespokeSections(SNAPSHOT))).toEqual([]);
  });

  it("covers every piece, fitting, text and logo field the schema allows", () => {
    const leaves = schemaLeaves(designSchema as unknown as Node).map((leaf) => leaf.path.replace(/\.\d+\./g, ".0.").replace(/\.\d+$/, ".0"));
    const held = new Set(leafPaths(SNAPSHOT.design).map((path) => path.replace(/\.\d+\./g, ".0.")));
    const missing = leaves.filter((path) => !path.includes(".points.0.") && !held.has(path));
    expect(missing).toEqual([]);
  });

  it("changes the printed sheet when any field on a piece changes", () => {
    const before = flatten(bespokeSections(SNAPSHOT));
    const paths = leafPaths(SNAPSHOT.design).filter((path) => !/\.points\.|^version$|\.closed$|\.id$|holeOf|\.logo\.id$|^bodyId$|^pieces\.1\.|^pieces\.2\.fold/.test(path));
    const silent = paths.filter((path) => {
      const value = getPath(SNAPSHOT.design, path);
      if (value === null || Array.isArray(value)) return false;
      const options: Record<string, string[]> = { finish: ["pebble"], color: ["noir"], thread: ["noir"], kind: ["panel", "tube"], view: ["back"], tubeStyle: ["flat"], textPlace: ["top"], technique: ["palladium"], font: ["grotesk"], style: ["deboss"], shape: ["round", "long"], metal: ["brass"], productType: ["wallet"], lining: ["noir"] };
      const key = path.split(".").at(-1)!;
      if (key === "kind") return false;
      const swapped = setPath(SNAPSHOT.design, path, changed(value, options[key]));
      return flatten(bespokeSections({ ...SNAPSHOT, design: swapped as BespokeDesign })) === before;
    });
    expect(silent).toEqual([]);
  });

  it("states every fitting with its position and rotation", () => {
    const text = flatten(bespokeSections(SNAPSHOT));
    expect(text).toContain("Fitting 1, Zip line");
    expect(text).toContain("180 mm (7.09 in) long");
    expect(text).toContain("turned 15 degrees");
    expect(text).toContain("A.K. 1999");
    expect(text).toContain("Logo rotation|12 degrees");
    expect(text).toContain("Logo width|45 mm (1.77 in)");
  });
});

describe("standard products", () => {
  it("shows every stored detail, frozen", () => {
    const sections = productSections(PRODUCT);
    expect(unrepresentedPaths(PRODUCT, sections)).toEqual([]);
    const text = flatten(sections);
    for (const value of ["Cabas 38", "CAB-38-COG", "Cognac", "One size", "100% calf leather", "tote bags", "Soft everyday tote", "380 mm"]) expect(text).toContain(value);
  });

  it("copes with a product that has no stored recipe", () => {
    const plain = { ...PRODUCT, studioPreset: null };
    expect(unrepresentedPaths(plain, productSections(plain))).toEqual([]);
    expect(flatten(productSections(plain))).toContain("Not stored for this product");
  });

  it("keeps its copy when the catalogue changes later", () => {
    const product = { id: "p", slug: "s", name: "Before", description: "d", composition: "c", categorySlug: "x", images: ["/images/a.jpg"], studioPreset: null };
    const copy = productSnapshotOf(product, { sku: "SKU", color: "Noir", size: "M" });
    product.name = "After";
    product.images.push("/images/b.jpg");
    expect(copy.name).toBe("Before");
    expect(copy.images).toEqual(["/images/a.jpg"]);
  });
});

describe("sheet contents", () => {
  const files: SheetFile[] = SHEET_VIEW_KEYS.map((slot, index) => ({ id: `view-${index}`, orderItemId: "a", kind: "view", slot, label: "", contentType: "image/jpeg", width: 1600, height: 1600 }));
  const sheet = (items: SheetItem[], includeAddress = false, status = "paid") => buildSheet(baseOrder(items, status), files, { includeAddress });
  const document = (items: SheetItem[], includeAddress = false) => sheetDocument(sheet(items, includeAddress), URLS, "nonce123");

  it("counts required-by from the payment date and the frozen making time", () => {
    const built = sheet([studioItem]);
    expect(built.requiredBy).toBe("1 April 2026");
    expect(requiredByDate(new Date("2026-01-01T00:00:00Z"), 10).toISOString().slice(0, 10)).toBe("2026-01-11");
  });

  it("has the six required angles, in order", () => {
    expect(SHEET_VIEW_KEYS).toEqual(["threeQuarter", "front", "back", "left", "right", "top"]);
    expect(sheet([studioItem]).lines[0]!.pictures.map((picture) => picture.label)).toEqual(SHEET_VIEW_KEYS.map((key) => SHEET_VIEWS[key].label));
    expect(sheet([bespokeItem]).lines[0]!.missingViews).toEqual(SHEET_VIEW_KEYS);
  });

  it("shows no prices, money, email or phone", () => {
    const text = document([studioItem, bespokeItem, productItem, balanceItem]);
    expect(text).not.toMatch(/\$\d|USD|deposit|Deposit|\bpaid\b|cents/);
    expect(text).not.toContain("+923001234567");
    expect(text).not.toContain("Jane Secret");
    expect(text).not.toContain("Hidden Road");
    expect(text).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
  });

  it("keeps the phone number off the sheet even with the address on", () => {
    const text = document([studioItem], true);
    expect(text).toContain("1 Hidden Road");
    expect(text).toContain("Jane Secret");
    expect(text).not.toContain("+923001234567");
  });

  it("treats a balance payment as nothing to make", () => {
    const built = sheet([bespokeItem, balanceItem]);
    expect(built.pieces).toBe(1);
    expect(built.lines[1]!.kind).toBe("payment");
    expect(built.lines[1]!.sections).toEqual([]);
  });

  it("tells the maker to stop when an order is cancelled", () => {
    const text = sheetDocument(sheet([studioItem], false, "cancelled"), URLS, undefined);
    expect(text).toContain("Do not start or continue work");
  });

  it("escapes customer text and adds no raw markup", () => {
    const hostile: BespokeSnapshot = { ...SNAPSHOT, notes: `</td><script>alert(1)</script><img src=x onerror=alert(2)>`, design: { ...SNAPSHOT.design, name: `"><svg onload=alert(3)>` } };
    const text = document([{ ...bespokeItem, name: "<script>x</script>", bespokeSnapshot: hostile }]);
    expect(text).not.toContain("<script>alert");
    expect(text).not.toContain("<script>x");
    expect(text).not.toContain("<svg onload");
    expect(text).not.toContain("<img src=x");
    expect(text).toContain("&lt;script&gt;alert(1)");
    expect(text.match(/<script/g)).toHaveLength(1);
    expect(text).toContain('<script nonce="nonce123">');
    expect(text).toContain('content="noindex, nofollow"');
  });

  it("represents every row in the page", () => {
    const built = sheet([studioItem, productItem]);
    const text = sheetDocument(built, URLS, undefined);
    const plain = text.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
    for (const line of built.lines) for (const section of line.sections) for (const row of section.rows) {
      expect(plain).toContain(row.label);
      expect(plain).toContain(row.value);
    }
  });
});

describe("PDF", () => {
  const jpeg = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64"));

  it("embeds images and starts with a valid header", () => {
    const pdf = new PdfDocument();
    const image = pdf.addImage(jpeg, 1, 1);
    pdf.addPage(210, 297).image(image, 10, 10, 50, 50);
    const text = Buffer.from(pdf.render()).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("/XObject << /Im0");
    expect(text).toContain("/Im0 Do");
    const objects = [...text.matchAll(/(\d+) 0 obj/g)].length;
    expect(text).toContain(`/Size ${objects + 1}`);
  });

  it("escapes PDF string syntax in customer text", () => {
    const hostile: BespokeSnapshot = { ...SNAPSHOT, notes: "x) Tj (y\\", design: { ...SNAPSHOT.design, notes: "plain" } };
    const built = buildSheet(baseOrder([{ ...bespokeItem, bespokeSnapshot: hostile }]), [], { includeAddress: false });
    const text = Buffer.from(sheetPdf(built, new Map())).toString("latin1");
    expect(text).toContain("x\\) Tj \\(y\\\\");
    expect(text).not.toContain("(x) Tj (y");
  });

  it("flags wording this font cannot show rather than hiding it", () => {
    expect(pdfText("Plain “quoted” – text").exact).toBe(true);
    expect(pdfText("Plain “quoted” – text").text).toBe('Plain "quoted" - text');
    expect(pdfText("محمد").exact).toBe(false);
    const hostile: BespokeSnapshot = { ...SNAPSHOT, notes: "محمد" };
    const built = buildSheet(baseOrder([{ ...bespokeItem, bespokeSnapshot: hostile }]), [], { includeAddress: false });
    expect(Buffer.from(sheetPdf(built, new Map())).toString("latin1")).toContain("See the online sheet");
  });

  it("wraps long values without losing words", () => {
    const value = "word ".repeat(80).trim();
    const lines = wrapText(value, 120);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(value);
    expect(wrapText("x".repeat(300), 60).join("")).toBe("x".repeat(300));
  });

  it("shows no price, email or phone", () => {
    const built = buildSheet(baseOrder([studioItem, bespokeItem, productItem, balanceItem]), [], { includeAddress: false });
    const text = Buffer.from(sheetPdf(built, new Map())).toString("latin1");
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toContain("Jane Secret");
    expect(text).not.toContain("+923001234567");
    expect(text).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
  });

  it("carries the cut sheet and pattern for a bespoke line", () => {
    const built = buildSheet(baseOrder([bespokeItem]), [], { includeAddress: false });
    const text = Buffer.from(sheetPdf(built, new Map())).toString("latin1");
    expect(text).toContain("Cut sheet BR-000123");
    expect(text).toContain("DRAFT PATTERN");
  });
});

describe("what checkout stores", () => {
  const orders = readFileSync("src/lib/server/orders.ts", "utf8");

  it("copies the whole spec, price, product and bespoke design onto the order line", () => {
    expect(orders).toContain("designSpec: spec");
    expect(orders).toContain("designPrice: quote");
    expect(orders).toContain("productSnapshot: snapshot");
    expect(orders).toContain("bespokeSnapshotOf(request, reference)");
    expect(orders).toContain("makingDays: delivery.makingMaxDays");
    expect(orders).toContain("freezeBespokeFiles(tx");
    expect(orders).toContain("freezeMediaPhotos(tx");
  });

  it("keeps every studio choice through the schema that checkout parses with", () => {
    const parsed = designSpecSchema.parse(FULL_SPEC);
    expect(parsed).toEqual(FULL_SPEC);
    expect(leafPaths(parsed).sort()).toEqual(leafPaths(FULL_SPEC).sort());
  });

  it("keeps every bespoke choice in the frozen design", () => {
    const stored = JSON.parse(JSON.stringify(SNAPSHOT)) as BespokeSnapshot;
    expect(designSchema.parse(stored.design)).toEqual(designSchema.parse(FULL_DESIGN));
    expect(stored.notes).toBe("Request <note> & more");
  });
});
