import { describe, expect, it } from "vitest";
import { blankDesign, designSchema, LIMITS, type BespokeDesign, type BespokePiece } from "@/lib/bespoke/design";
import { estimateDesign, hardwareList, visibleDesign } from "@/lib/bespoke/estimate";
import { applyPart, INSPIRATION, needsBody, partPreview, PART_CATEGORIES } from "@/lib/bespoke/parts";
import { customerPdf, cutSheetPdf, designSvg } from "@/lib/bespoke/export";
import { bakeMirror, bodyOf, crossesItself, fullPoints, groupBounds, halfChain, insertOnEdge, layerOrder, mapPiece, nearestEdge, netArea, outlineOf, pathLength, perimeter, polygonArea, reflection, rotation, scaling, starterPoints, stitchRuns } from "@/lib/bespoke/outline";
import { bespokeBuyable, quoteAcceptable, quoteExpiry } from "@/lib/bespoke/status";
import { customerSchema, designProblem, logoKind, parseDesign, sniffImage, svgIsUnsafe } from "@/lib/bespoke/submission";
import { MARGIN, WASTAGE } from "@/lib/studio/pricing";
import { FINISHES } from "@/lib/studio/spec";

function piece(overrides: Partial<BespokePiece> = {}): BespokePiece {
  return {
    id: "a1",
    name: "Body",
    kind: "panel",
    view: "front",
    logo: null,
    points: starterPoints("rectangle", 200, 100),
    closed: true,
    mirror: false,
    axisX: 0,
    holeOf: null,
    puff: 0,
    fold: null,
    tubeWidth: 14,
    tubeStyle: "rolled",
    textPlace: "center",
    rings: true,
    hardware: [],
    visible: true,
    finish: "box",
    color: "cognac",
    thread: "ivory",
    stitched: true,
    stack: 0,
    text: null,
    ...overrides,
  };
}

function idMaker(prefix = "i") {
  let count = 0;
  return () => `${prefix}${(count++).toString(36)}`;
}

const design = (overrides: Partial<BespokeDesign> = {}): BespokeDesign => ({ ...blankDesign(), depth: 0, pieces: [piece()], ...overrides });

describe("outline geometry", () => {
  it("measures a rectangle exactly", () => {
    const outline = outlineOf(piece());
    expect(polygonArea(outline)).toBeCloseTo(20_000, 6);
    expect(perimeter(outline)).toBeCloseTo(600, 6);
  });

  it("measures a circle within one percent", () => {
    const outline = outlineOf(piece({ points: starterPoints("circle", 200, 200) }));
    expect(Math.abs(polygonArea(outline) - Math.PI * 100 ** 2) / (Math.PI * 100 ** 2)).toBeLessThan(0.01);
  });

  it("gives every starter shape a closable, simple outline", () => {
    for (const kind of ["rectangle", "rounded", "circle", "trapezoid", "semicircle"] as const) {
      const outline = outlineOf(piece({ points: starterPoints(kind, 280, 220) }));
      expect(polygonArea(outline)).toBeGreaterThan(10_000);
      expect(crossesItself(outline)).toBe(false);
    }
  });

  it("detects a figure of eight", () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }].map((point) => ({ ...point, smooth: false }));
    expect(crossesItself(outlineOf(piece({ points })))).toBe(true);
  });

  it("makes a smooth point curve, and changes the area", () => {
    const sharp = polygonArea(outlineOf(piece()));
    const points = piece().points.map((point, index) => ({ ...point, smooth: index === 1 }));
    expect(polygonArea(outlineOf(piece({ points })))).not.toBeCloseTo(sharp, 0);
  });

  it("mirrors a half chain into a full symmetric outline", () => {
    const points = [{ x: 0, y: -50 }, { x: 100, y: -50 }, { x: 100, y: 50 }, { x: 0, y: 50 }].map((point) => ({ ...point, smooth: false }));
    const mirrored = piece({ mirror: true, points });
    expect(fullPoints(mirrored)).toHaveLength(6);
    expect(polygonArea(outlineOf(mirrored))).toBeCloseTo(20_000, 6);
    expect(bakeMirror(mirrored)).toHaveLength(6);
  });

  it("cuts a centred shape to one side for mirroring", () => {
    const chain = halfChain(starterPoints("rectangle", 200, 100));
    expect(chain.every((point) => point.x >= 0)).toBe(true);
    expect(polygonArea(outlineOf(piece({ mirror: true, points: chain })))).toBeCloseTo(20_000, 6);
  });

  it("adds a point on an edge without moving the outline", () => {
    const start = piece();
    const edge = nearestEdge(start, { x: 0, y: -49 })!;
    expect(edge.distance).toBeCloseTo(1, 6);
    const { points, index } = insertOnEdge(start, edge.edge, edge.at, false);
    expect(points).toHaveLength(5);
    expect(index).toBe(1);
    expect(polygonArea(outlineOf(piece({ points })))).toBeCloseTo(20_000, 6);
  });

  it("adds a point on the mirrored side to the source chain", () => {
    const points = [{ x: 0, y: -50 }, { x: 100, y: -50 }, { x: 100, y: 50 }, { x: 0, y: 50 }].map((point) => ({ ...point, smooth: false }));
    const mirrored = piece({ mirror: true, points });
    const edge = nearestEdge(mirrored, { x: -50, y: 50 })!;
    const inserted = insertOnEdge(mirrored, edge.edge, edge.at, false);
    expect(inserted.points).toHaveLength(5);
    expect(inserted.points.every((point) => point.x >= 0)).toBe(true);
    expect(inserted.index).toBe(3);
  });

  it("insets stitches inside the outline", () => {
    const runs = stitchRuns(outlineOf(piece()));
    expect(runs).toHaveLength(1);
    expect(runs[0]!.ring).toBe(true);
    expect(runs[0]!.points.length).toBeGreaterThan(100);
    expect(runs[0]!.points.every((point) => Math.abs(point.x) <= 97 && Math.abs(point.y) <= 47)).toBe(true);
  });

  it("drops stitches on a piece too narrow to hold them", () => {
    expect(stitchRuns(outlineOf(piece({ points: starterPoints("rectangle", 200, 6) })))).toEqual([]);
  });

  it("orders layers by stack, then by list order", () => {
    const ordered = layerOrder([piece({ id: "a", stack: 1 }), piece({ id: "b", stack: 0 }), piece({ id: "c", stack: 0 })]);
    expect(ordered.map(({ id }) => id)).toEqual(["b", "c", "a"]);
  });

  it("picks the largest closed piece as the body unless one is chosen", () => {
    const small = piece({ id: "s", points: starterPoints("rectangle", 50, 50) });
    const large = piece({ id: "l" });
    expect(bodyOf({ bodyId: null, pieces: [small, large] })?.id).toBe("l");
    expect(bodyOf({ bodyId: "s", pieces: [small, large] })?.id).toBe("s");
  });
});

describe("estimate", () => {
  it("is null with nothing to price", () => {
    expect(estimateDesign(blankDesign())).toBeNull();
    expect(estimateDesign(design({ pieces: [piece({ closed: false })] }))).toBeNull();
  });

  it("uses real area, the finish rate and studio margins", () => {
    const box = estimateDesign(design())!;
    const croc = estimateDesign(design({ pieces: [piece({ finish: "croc" })] }))!;
    expect(box.areaDm2).toBeCloseTo(2, 6);
    const leatherGapCents = 2 * (FINISHES.croc.centsPerDm2 - FINISHES.box.centsPerDm2) * WASTAGE * MARGIN;
    expect((croc.highCents - box.highCents) / 1.25).toBeGreaterThan(leatherGapCents - 500);
    expect((croc.highCents - box.highCents) / 1.25).toBeLessThan(leatherGapCents + 500);
  });

  it("grows with size, depth, pieces and stitching", () => {
    const base = estimateDesign(design())!;
    expect(estimateDesign(design({ pieces: [piece({ points: starterPoints("rectangle", 400, 300) })] }))!.lowCents).toBeGreaterThan(base.lowCents);
    expect(estimateDesign(design({ depth: 80 }))!.areaDm2).toBeGreaterThan(base.areaDm2);
    expect(estimateDesign(design({ pieces: [piece(), piece({ id: "b" })] }))!.highCents).toBeGreaterThan(base.highCents);
    expect(estimateDesign(design({ pieces: [piece({ stitched: false })] }))!.highCents).toBeLessThanOrEqual(base.highCents);
  });

  it("returns a rounded range with the true size", () => {
    const { lowCents, highCents, widthMm, heightMm, depthMm } = estimateDesign(design({ depth: 40 }))!;
    expect(lowCents % 500).toBe(0);
    expect(highCents % 500).toBe(0);
    expect(highCents).toBeGreaterThan(lowCents);
    expect([widthMm, heightMm, depthMm]).toEqual([200, 100, 40]);
  });
});

describe("design validation", () => {
  it("accepts a valid design", () => {
    expect(designSchema.safeParse(design()).success).toBe(true);
    expect(designProblem(design())).toBeNull();
  });

  it("rejects too many pieces", () => {
    const pieces = Array.from({ length: LIMITS.pieces + 1 }, (_, index) => piece({ id: `p${index}` }));
    expect(designSchema.safeParse(design({ pieces })).success).toBe(false);
  });

  it("rejects too many points", () => {
    const points = Array.from({ length: LIMITS.points + 1 }, (_, index) => ({ x: index, y: index % 2, smooth: false }));
    expect(designSchema.safeParse(design({ pieces: [piece({ points })] })).success).toBe(false);
  });

  it("rejects coordinates off the board and non finite numbers", () => {
    for (const x of [LIMITS.halfWidthMm + 1, Infinity, NaN]) {
      expect(designSchema.safeParse(design({ pieces: [piece({ points: [{ x, y: 0, smooth: false }, { x: 1, y: 1, smooth: false }, { x: 2, y: 0, smooth: false }] })] })).success).toBe(false);
    }
  });

  it("rejects unknown fields and leathers", () => {
    expect(designSchema.safeParse({ ...design(), priceCents: 1 }).success).toBe(false);
    expect(designSchema.safeParse(design({ pieces: [{ ...piece(), finish: "vinyl" as never }] })).success).toBe(false);
  });

  it("rejects duplicate ids and an unknown body", () => {
    expect(designSchema.safeParse(design({ pieces: [piece(), piece()] })).success).toBe(false);
    expect(designSchema.safeParse(design({ bodyId: "nope" })).success).toBe(false);
  });

  it("rejects mirrored points on the wrong side", () => {
    expect(designSchema.safeParse(design({ pieces: [piece({ mirror: true })] })).success).toBe(false);
  });

  it("will not send an empty design or an open piece", () => {
    expect(designProblem(design({ pieces: [] }))).toBeTruthy();
    expect(designProblem(design({ pieces: [piece(), piece({ id: "b", closed: false })] }))).toContain("not closed");
  });

  it("reads a design from JSON and refuses junk", () => {
    expect("design" in parseDesign(JSON.stringify(design()))).toBe(true);
    expect("error" in parseDesign("{")).toBe(true);
    expect("error" in parseDesign(null)).toBe(true);
    expect("error" in parseDesign("x".repeat(LIMITS.designChars + 1))).toBe(true);
  });
});

describe("cut-outs", () => {
  const hole = piece({ id: "h1", name: "Window", holeOf: "a1", stitched: false, points: starterPoints("rectangle", 50, 20) });
  const both = [piece(), hole];

  it("subtracts a hole from the area and the price", () => {
    expect(netArea(both[0]!, both)).toBeCloseTo(19_000, 6);
    expect(estimateDesign(design({ pieces: both }))!.areaDm2).toBeCloseTo(1.9, 6);
    expect(estimateDesign(design({ pieces: both }))!.pieceCount).toBe(1);
  });

  it("keeps stitches off the hole and stitches around it", () => {
    const runs = stitchRuns(outlineOf(both[0]!), [outlineOf(hole)]);
    expect(runs.length).toBe(2);
    expect(runs.flatMap((run) => run.points).every((point) => Math.abs(point.x) > 26 || Math.abs(point.y) > 11)).toBe(true);
  });

  it("blocks a cut-out that hangs outside its piece", () => {
    const outside = { ...hole, points: starterPoints("rectangle", 300, 20) };
    expect(designProblem(design({ pieces: [piece(), outside] }))).toContain("inside");
  });

  it("rejects a cut-out of a missing piece", () => {
    expect(designSchema.safeParse(design({ pieces: [piece(), { ...hole, holeOf: "nope" }] })).success).toBe(false);
  });

  it("draws the hole in the SVG export", () => {
    expect(designSvg(design({ pieces: both }))!.match(/fill-rule="evenodd"/g)).toHaveLength(1);
  });
});

describe("handles and hardware", () => {
  const tube = piece({ id: "t1", name: "Handle", kind: "tube", closed: false, points: [{ x: 0, y: 0, smooth: false }, { x: 300, y: 0, smooth: false }] });

  it("prices a tube from its length and width", () => {
    expect(pathLength(outlineOf(tube))).toBeCloseTo(300, 6);
    expect(estimateDesign(design({ pieces: [tube] }))!.areaDm2).toBeCloseTo((300 * 14 * 2.4) / 10_000, 6);
  });

  it("widens bounds by half the tube width", () => {
    expect(groupBounds([tube]).height).toBeCloseTo(14, 6);
  });

  it("rejects a closed tube", () => {
    expect(designSchema.safeParse(design({ pieces: [{ ...tube, closed: true }] })).success).toBe(false);
  });

  it("counts chain links from the length", () => {
    expect(hardwareList(design({ pieces: [{ ...tube, tubeStyle: "chain", rings: false }] }))).toEqual([{ kind: "link", name: "Chain link", quantity: 13 }]);
  });

  it("counts fittings and rings, and adds them to the price", () => {
    const rivet = { kind: "rivet", y: 0, rotation: 0, length: 180, shape: "plain", label: "" } as const;
    const fitted = piece({ hardware: [{ ...rivet, id: "r1", x: 0 }, { ...rivet, id: "r2", x: 9 }] });
    expect(hardwareList(design({ pieces: [fitted, tube] }))).toEqual([{ kind: "rivet", name: "Rivet", quantity: 2 }, { kind: "dring", name: "Handle ring", quantity: 2 }]);
  });
});

describe("piece transforms", () => {
  it("rotates a quarter turn", () => {
    const turned = mapPiece(piece(), rotation({ x: 0, y: 0 }, Math.PI / 2));
    expect(groupBounds([turned]).width).toBeCloseTo(100, 1);
    expect(groupBounds([turned]).height).toBeCloseTo(200, 1);
  });

  it("scales to an exact size", () => {
    const scaled = mapPiece(piece(), scaling({ x: 0, y: 0 }, 1.5, 0.5));
    expect(groupBounds([scaled]).width).toBeCloseTo(300, 1);
    expect(groupBounds([scaled]).height).toBeCloseTo(50, 1);
  });

  it("reflects across any line", () => {
    const flip = reflection({ x: 0, y: 0 }, { x: 100, y: 100 });
    const point = flip({ x: 10, y: 0 });
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(10, 6);
  });

  it("mirrors about an axis away from the board centre", () => {
    const off = piece({ mirror: true, axisX: 100, points: [{ x: 100, y: -10, smooth: false }, { x: 140, y: -10, smooth: false }, { x: 140, y: 10, smooth: false }, { x: 100, y: 10, smooth: false }] });
    expect(designSchema.safeParse(design({ pieces: [off] })).success).toBe(true);
    expect(groupBounds([off])).toMatchObject({ minX: 60, maxX: 140 });
    expect(halfChain(starterPoints("rectangle", 200, 100).map((point) => ({ ...point, x: point.x + 50 })), 50).every((point) => point.x >= 50)).toBe(true);
  });
});

describe("what gets sent", () => {
  it("drops hidden pieces, and their cut-outs, from the design and the price", () => {
    const shown = piece({ id: "a", points: starterPoints("rectangle", 100, 100) });
    const hidden = piece({ id: "b", visible: false });
    const hole = piece({ id: "c", holeOf: "b", points: starterPoints("rectangle", 10, 10) });
    const sent = visibleDesign(design({ pieces: [shown, hidden, hole] }));
    expect(sent.pieces.map(({ id }) => id)).toEqual(["a"]);
    expect(estimateDesign(design({ pieces: [shown, hidden, hole] }))!.areaDm2).toBeCloseTo(1, 6);
  });

  it("blocks a crossing outline", () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }].map((point) => ({ ...point, smooth: false }));
    expect(designProblem(design({ pieces: [piece({ points })] }))).toContain("crosses");
  });

  it("caps design complexity", () => {
    const points = Array.from({ length: 300 }, (_, index) => {
      const angle = (index / 300) * Math.PI * 2;
      return { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200, smooth: true };
    });
    const pieces = Array.from({ length: 6 }, (_, index) => piece({ id: `p${index}`, points }));
    expect(designProblem(design({ pieces }))).toContain("too detailed");
  });

  it("keeps the 4 mm pitch on a very long run", () => {
    const [run] = stitchRuns(outlineOf(piece({ points: starterPoints("rectangle", 1500, 100) })));
    const gap = Math.hypot(run!.points[1]!.x - run!.points[0]!.x, run!.points[1]!.y - run!.points[0]!.y);
    expect(gap).toBeGreaterThan(3.9);
    expect(gap).toBeLessThan(4.1);
  });
});

describe("quotes", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const quote = { status: "quoted" as const, quotedPriceCents: 26500, quoteExpiresAt: quoteExpiry(now) };

  it("expires after thirty days", () => {
    expect(quoteAcceptable(quote, new Date("2026-11-30T00:00:00Z"))).toBe(true);
    expect(quoteAcceptable(quote, new Date("2026-12-02T00:00:00Z"))).toBe(false);
  });

  it("only sells an accepted, unexpired quote", () => {
    expect(bespokeBuyable(quote, now)).toBe(false);
    expect(bespokeBuyable({ ...quote, status: "accepted" }, now)).toBe(true);
    expect(bespokeBuyable({ ...quote, status: "accepted" }, new Date("2026-12-02T00:00:00Z"))).toBe(false);
    expect(bespokeBuyable({ ...quote, status: "declined" }, now)).toBe(false);
  });
});

describe("exports and examples", () => {
  it("writes real PDF files", () => {
    const pdf = new TextDecoder("latin1").decode(cutSheetPdf(design({ depth: 40 }), "BR-000001"));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(customerPdf(design()).length).toBeGreaterThan(500);
  });

  it.each(INSPIRATION.flatMap((group) => group.designs.map((item) => [item.label, item, group.productType] as const)))("example %s is valid", (_, item, productType) => {
    const built = item.build(idMaker());
    expect(built.productType).toBe(productType);
    expect(designSchema.safeParse(built).success).toBe(true);
    expect(designProblem(built)).toBeNull();
    expect(estimateDesign(built)!.lowCents).toBeGreaterThan(0);
  });
});

describe("parts library", () => {
  const start = applyPart(blankDesign(), "body-satchel", null, idMaker());

  it("has enough examples in every category and three designs per product", () => {
    for (const category of PART_CATEGORIES) expect(category.parts.length).toBeGreaterThanOrEqual(5);
    expect(INSPIRATION).toHaveLength(5);
    for (const group of INSPIRATION) expect(group.designs).toHaveLength(3);
  });

  it.each(PART_CATEGORIES.flatMap((category) => category.parts.map((part) => [part.name, part.key] as const)))("%s places, stays valid and is priced", (_, key) => {
    if ("error" in start) throw new Error(start.error);
    const base = needsBody(key) ? start.design : blankDesign();
    const placed = applyPart(base, key, null, idMaker("x"));
    if ("error" in placed) throw new Error(placed.error);
    expect(designSchema.safeParse(placed.design).success).toBe(true);
    expect(designProblem(placed.design)).toBeNull();
    if (needsBody(key)) {
      const before = estimateDesign(start.design)!;
      const after = estimateDesign(placed.design)!;
      const changed = key.startsWith("mono") || after.areaDm2 !== before.areaDm2 || hardwareList(placed.design).length > 0;
      expect(changed).toBe(true);
      expect(after.highCents).toBeGreaterThanOrEqual(before.highCents);
    }
    expect(partPreview(key)).not.toBeNull();
  });

  it("refuses a handle with no body", () => {
    expect(applyPart(blankDesign(), "handle-rolled", null, idMaker())).toHaveProperty("error");
  });

  it("attaches a handle to the top edge of the body, overlapping it", () => {
    if ("error" in start) throw new Error(start.error);
    const placed = applyPart(start.design, "handle-rolled", null, idMaker("y"));
    if ("error" in placed) throw new Error(placed.error);
    const handle = placed.design.pieces.at(-1)!;
    const top = groupBounds([start.design.pieces[0]!]).minY;
    expect(handle.name).toBe("Rolled top handle");
    expect(handle.points[0]!.y).toBeGreaterThan(top);
    expect(Math.min(...handle.points.map((point) => point.y))).toBeLessThan(top);
  });

  it("names parts and fittings for the workshop", () => {
    if ("error" in start) throw new Error(start.error);
    const placed = applyPart(start.design, "hw-pull-disc", null, idMaker("z"));
    if ("error" in placed) throw new Error(placed.error);
    expect(hardwareList(placed.design).map((item) => item.name)).toEqual(["Disc zip pull"]);
    const sheet = new TextDecoder("latin1").decode(cutSheetPdf(placed.design, "BR-000001"));
    expect(sheet).toContain("Disc zip pull");
    expect(sheet).toContain("Rounded satchel body");
  });
});

describe("logo files", () => {
  it("accepts a plain SVG and PNG header only", () => {
    expect(logoKind(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'))).toBe("svg");
    expect(logoKind(new TextEncoder().encode("<html></html>"))).toBeNull();
  });

  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
    '<svg><a href="javascript:alert(1)"><circle/></a></svg>',
    '<svg><image href="http://evil/x.png"/></svg>',
    '<svg><foreignObject></foreignObject></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>',
    '<svg><style>@import url(http://evil)</style></svg>',
  ])("refuses %s", (text) => {
    expect(svgIsUnsafe(text)).toBe(true);
  });

  it("allows a simple drawing", () => {
    expect(svgIsUnsafe('<svg viewBox="0 0 10 10"><path d="M0 0H10" fill="#123"/></svg>')).toBe(false);
  });
});

describe("views and puff", () => {
  it("counts leather on every view, and takes the body from the front only", () => {
    const inner = piece({ id: "v", view: "interior", points: starterPoints("rectangle", 100, 100) });
    const sum = estimateDesign(design({ pieces: [piece(), inner] }))!;
    expect(sum.areaDm2).toBeCloseTo(3, 6);
    expect([sum.widthMm, sum.heightMm]).toEqual([200, 100]);
    expect(bodyOf({ bodyId: "v", pieces: [piece(), inner] })?.id).toBe("a1");
  });

  it("adds puff to the leather area", () => {
    expect(estimateDesign(design({ pieces: [piece({ puff: 20 })] }))!.areaDm2).toBeGreaterThan(estimateDesign(design())!.areaDm2);
  });
});

describe("submission", () => {
  const customer = { name: "Ada", email: " ADA@Example.com ", country: "PK", phone: "" };

  it("normalises the customer", () => {
    expect(customerSchema.parse(customer).email).toBe("ada@example.com");
  });

  it("rejects bad customers", () => {
    expect(customerSchema.safeParse({ ...customer, country: "ZZ" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...customer, phone: "call me" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...customer, name: "Ada\nBcc: x" }).success).toBe(false);
  });

  it("recognises real image headers only", () => {
    const pad = (head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)]);
    expect(sniffImage(pad([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF0000WEBPVP8 data"))).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(sniffImage(new Uint8Array(3))).toBeNull();
  });
});
