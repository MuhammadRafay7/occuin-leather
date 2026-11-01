import { describe, expect, it } from "vitest";
import { HIDE_WASTAGE, PATTERN, RULES, SEAM_ALLOWANCE_MM } from "@/lib/bespoke/config";
import { blankDesign, designSchema, type BespokeDesign, type BespokePiece } from "@/lib/bespoke/design";
import { estimateDesign } from "@/lib/bespoke/estimate";
import { crossesItself, outlineOf, perimeter, polygonArea, starterPoints } from "@/lib/bespoke/outline";
import { applyPart, INSPIRATION, PART_CATEGORIES } from "@/lib/bespoke/parts";
import { patternPdf, patternSvg } from "@/lib/bespoke/production";
import { narrowestWidth, offsetOutline, shapeGap, tightestCurveRadius } from "@/lib/bespoke/production/geometry";
import { buildPattern, cornerIndexes, unfoldWall } from "@/lib/bespoke/production/pattern";
import { clipLine, DRAFT_NOTICE, FRAME, patternSheets, tileGrid } from "@/lib/bespoke/production/sheets";
import { checkDesign, type Finding } from "@/lib/bespoke/rules";
import { designProblem, parseDesign } from "@/lib/bespoke/submission";

function piece(overrides: Partial<BespokePiece> = {}): BespokePiece {
  return {
    id: "body",
    name: "Body",
    kind: "panel",
    view: "front",
    logo: null,
    points: starterPoints("rectangle", 300, 200),
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
    thread: "honey",
    stitched: true,
    stack: 0,
    text: null,
    ...overrides,
  };
}

const design = (pieces: BespokePiece[], overrides: Partial<BespokeDesign> = {}): BespokeDesign => ({ ...blankDesign(), depth: 60, pieces, ...overrides });
const fitting = (overrides: Partial<BespokePiece["hardware"][number]> = {}): BespokePiece["hardware"][number] => ({ id: "fit", kind: "rivet", x: 0, y: 0, rotation: 0, length: 30, shape: "plain", label: "", ...overrides });
const rect = (cx: number, cy: number, width: number, height: number) => starterPoints("rectangle", width, height).map((point) => ({ ...point, x: point.x + cx, y: point.y + cy }));
const tube = (id: string, points: [number, number][], overrides: Partial<BespokePiece> = {}) => piece({ id, name: id, kind: "tube", closed: false, stack: 2, points: points.map(([x, y]) => ({ x, y, smooth: false })), ...overrides });
const found = (findings: Finding[], id: string) => findings.find((item) => item.id.startsWith(id));

let serial = 0;
const newId = () => (++serial).toString(36).padStart(6, "a");

describe("seam offset", () => {
  it("grows a rectangle by the allowance on every side", () => {
    const grown = offsetOutline(outlineOf(piece()), 6);
    expect(polygonArea(grown)).toBeCloseTo(312 * 212, 3);
  });

  it("grows a circle by the allowance", () => {
    const circle = outlineOf(piece({ points: starterPoints("circle", 200, 200) }));
    const grown = offsetOutline(circle, 6);
    const radius = Math.sqrt(polygonArea(circle) / Math.PI);
    expect(Math.sqrt(polygonArea(grown) / Math.PI)).toBeCloseTo(radius + 6, 0);
  });

  it("keeps a concave shape free of crossings", () => {
    const notched = [[-100, -100], [100, -100], [100, 100], [4, 100], [4, 0], [-4, 0], [-4, 100], [-100, 100]].map(([x, y]) => ({ x: x!, y: y! }));
    const grown = offsetOutline(notched, 6);
    expect(crossesItself(grown)).toBe(false);
    expect(polygonArea(grown)).toBeGreaterThan(polygonArea(notched));
  });

  it("shrinks a hole for a negative allowance", () => {
    expect(polygonArea(offsetOutline(outlineOf(piece()), -6))).toBeCloseTo(288 * 188, 3);
  });
});

describe("gusset unfolding", () => {
  it("splits a rectangular body into two sides and a base, leaving the top open", () => {
    const wall = unfoldWall(outlineOf(piece()));
    expect(wall.runs.map((run) => run.name).sort()).toEqual(["Base panel", "Left side panel", "Right side panel"]);
    expect(wall.runs.find((run) => run.name === "Base panel")!.length).toBeCloseTo(300, 6);
    expect(wall.runs.find((run) => run.name === "Left side panel")!.length).toBeCloseTo(200, 6);
    expect(wall.top).toBeCloseTo(300, 6);
  });

  it("keeps a rounded body as one strip that matches the outline exactly", () => {
    const outline = outlineOf(piece({ points: starterPoints("rounded", 300, 220) }));
    const wall = unfoldWall(outline);
    expect(wall.runs).toHaveLength(1);
    expect(wall.runs[0]!.name).toBe("Gusset");
    expect(wall.runs[0]!.length + wall.top).toBeCloseTo(perimeter(outline), 6);
    expect(wall.runs[0]!.corners.length).toBe(2);
  });

  it("wraps the whole outline when no edge faces up", () => {
    const points = [{ x: 0, y: -100, smooth: false }, { x: 30, y: 100, smooth: false }, { x: -30, y: 100, smooth: false }];
    const wall = unfoldWall(outlineOf(piece({ points })));
    const total = wall.runs.reduce((sum, run) => sum + run.length, 0);
    expect(total).toBeCloseTo(perimeter(outlineOf(piece({ points }))), 6);
  });

  it("cuts strips as long as the wall by the depth, plus the allowance", () => {
    const pattern = buildPattern(design([piece()], { depth: 80 }));
    const base = pattern.pieces.find((item) => item.name.startsWith("Base panel"))!;
    expect(base.width).toBeCloseTo(300 + SEAM_ALLOWANCE_MM * 2, 6);
    expect(base.height).toBeCloseTo(80 + SEAM_ALLOWANCE_MM * 2, 6);
    expect(base.role).toBe("gusset");
    expect(pattern.pieces.map((item) => item.role)).toEqual(["panel", "back", "gusset", "gusset", "gusset"]);
  });

  it("adds a top band when the closure is a zip", () => {
    const pattern = buildPattern(design([piece()], { closure: "Top zip" }));
    expect(pattern.pieces.filter((item) => item.role === "top")).toHaveLength(1);
    expect(buildPattern(design([piece()])).notes.join(" ")).toContain("left open");
  });

  it("draws no back or gusset for a flat piece", () => {
    expect(buildPattern(design([piece()], { depth: 0 })).pieces.map((item) => item.role)).toEqual(["panel"]);
  });
});

describe("pattern pieces", () => {
  it("honours a configured seam allowance", () => {
    const pattern = buildPattern(design([piece()], { depth: 0 }), { seamAllowanceMm: 10 });
    expect(pattern.pieces[0]!.width).toBeCloseTo(320, 6);
    expect(pattern.seamAllowanceMm).toBe(10);
  });

  it("defaults the allowance to 6 mm", () => {
    expect(SEAM_ALLOWANCE_MM).toBe(6);
    expect(buildPattern(design([piece()], { depth: 0 })).pieces[0]!.width).toBeCloseTo(312, 6);
  });

  it("notches every corner and mirrors the back", () => {
    const left = rect(-100, 0, 50, 100);
    const asymmetric = piece({ points: left });
    const pattern = buildPattern(design([asymmetric]));
    const [front, back] = pattern.pieces;
    expect(front!.notches.filter((notch) => notch.kind === "corner")).toHaveLength(4);
    expect(back!.name).toContain("back");
    expect(cornerIndexes(outlineOf(asymmetric))).toHaveLength(4);
  });

  it("notches handle positions on the body and marks the ends", () => {
    const handle = tube("handle", [[-60, -90], [-60, -160], [60, -160], [60, -90]]);
    const body = buildPattern(design([piece(), handle])).pieces[0]!;
    expect(body.notches.filter((notch) => notch.kind === "handle")).toHaveLength(2);
    expect(body.marks.filter((mark) => mark.label.includes("handle end"))).toHaveLength(2);
    expect(body.notches.filter((notch) => notch.kind === "handle").every((notch) => Math.abs(notch.at.y - SEAM_ALLOWANCE_MM) < 1e-6)).toBe(true);
  });

  it("runs the grain along strips and up the panels", () => {
    const handle = tube("handle", [[-60, -90], [60, -90]]);
    const { pieces } = buildPattern(design([piece(), handle], { depth: 0 }));
    const panel = pieces[0]!;
    const strip = pieces[1]!;
    expect(panel.grain.from.x).toBeCloseTo(panel.grain.to.x, 6);
    expect(strip.grain.from.y).toBeCloseTo(strip.grain.to.y, 6);
    expect(strip.height).toBeCloseTo(14 * PATTERN.tubeWrap + SEAM_ALLOWANCE_MM * 2, 6);
  });

  it("totals hide area with wastage by leather", () => {
    const pocket = piece({ id: "pocket", name: "Pocket", points: rect(0, 40, 100, 80), color: "noir", stack: 1 });
    const pattern = buildPattern(design([piece(), pocket], { depth: 0 }));
    expect(pattern.hide).toHaveLength(2);
    expect(pattern.totalNetDm2).toBeCloseTo((312 * 212 + 112 * 92) / 10_000, 6);
    expect(pattern.totalWithWastageDm2).toBeCloseTo(pattern.totalNetDm2 * HIDE_WASTAGE, 6);
    expect(pattern.hide[0]!.squareFeet).toBeGreaterThan(0);
  });

  it("agrees with the estimate on stitching and lists thread with the waste factor", () => {
    const shape = design([piece(), tube("handle", [[-60, -90], [60, -90]])]);
    const { thread } = buildPattern(shape);
    expect(thread.reduce((sum, line) => sum + line.stitchedMm, 0)).toBeCloseTo(estimateDesign(shape)!.stitchedMm, 3);
    expect(thread[0]!.lengthM).toBeCloseTo((thread[0]!.stitchedMm * PATTERN.threadPerStitchedMm) / 1000, 6);
  });

  it("lists hardware including handle rings", () => {
    const shape = design([piece({ hardware: [fitting()] }), tube("handle", [[-60, -90], [60, -90]])]);
    const names = buildPattern(shape).hardware.map((item) => `${item.quantity} ${item.name}`);
    expect(names).toEqual(expect.arrayContaining(["1 Rivet", "2 Handle ring"]));
  });

  it("cuts a hole smaller by the allowance so it finishes to size", () => {
    const hole = piece({ id: "hole", name: "Window", holeOf: "body", points: rect(0, 0, 100, 60), stitched: false });
    const front = buildPattern(design([piece(), hole], { depth: 0 })).pieces[0]!;
    expect(polygonArea(front.cutHoles[0]!)).toBeCloseTo(88 * 48, 3);
    expect(polygonArea(front.seamHoles[0]!)).toBeCloseTo(100 * 60, 3);
  });

  it("builds every library design without a crossing cut line", () => {
    for (const group of INSPIRATION) {
      for (const entry of group.designs) {
        for (const item of buildPattern(entry.build(newId)).pieces) expect(crossesItself(item.cut), `${entry.key} ${item.name}`).toBe(false);
      }
    }
  });
});

describe("sheets", () => {
  const large = design([piece({ points: rect(0, 0, 500, 400) })], { depth: 0 });
  const small = design([piece({ points: rect(0, 0, 80, 60) })], { depth: 0 });

  it("puts a 100 mm check square and the draft notice on every page", () => {
    for (const shape of [large, small, design([piece()])]) {
      for (const sheet of patternSheets(buildPattern(shape))) {
        const squares = sheet.ops.filter((op) => op.kind === "path" && op.stroke === "#1f43a0");
        expect(squares).toHaveLength(1);
        const [a, b, c] = (squares[0] as { points: { x: number; y: number }[] }).points;
        expect(b!.x - a!.x).toBeCloseTo(PATTERN.sheet.checkSquareMm, 9);
        expect(c!.y - b!.y).toBeCloseTo(PATTERN.sheet.checkSquareMm, 9);
        expect(sheet.ops.some((op) => op.kind === "text" && op.value === DRAFT_NOTICE)).toBe(true);
      }
    }
  });

  it("keeps a small piece on one page without tiling marks", () => {
    const sheets = patternSheets(buildPattern(small));
    expect(sheets).toHaveLength(2);
    expect(sheets.flatMap((sheet) => sheet.ops).some((op) => op.kind === "path" && op.stroke === "#a01f6a")).toBe(false);
  });

  it("tiles a large piece with shared registration marks", () => {
    const { cols, rows, stepX } = tileGrid(512 + 12, 412 + PATTERN.sheet.labelMm + 12);
    const sheets = patternSheets(buildPattern(large));
    expect(cols * rows).toBeGreaterThan(1);
    expect(sheets).toHaveLength(1 + cols * rows);
    const marks = (sheet: (typeof sheets)[number]) => sheet.ops.flatMap((op) => (op.kind === "path" && op.stroke === "#a01f6a" && op.points.length === 2 && op.points[0]!.y === op.points[1]!.y ? [(op.points[0]!.x + op.points[1]!.x) / 2] : []));
    const first = [...new Set(marks(sheets[1]!))].sort((a, b) => a - b);
    const second = [...new Set(marks(sheets[2]!))].sort((a, b) => a - b);
    expect(first).toHaveLength(2);
    expect(first[1]! - stepX).toBeCloseTo(second[0]!, 9);
  });

  it("clips every tile to the printable frame", () => {
    for (const sheet of patternSheets(buildPattern(large)).slice(1)) {
      for (const op of sheet.ops) {
        if (op.kind !== "path") continue;
        for (const point of op.points) {
          expect(point.x).toBeGreaterThanOrEqual(FRAME.x - 1e-6);
          expect(point.x).toBeLessThanOrEqual(FRAME.x + FRAME.width + 1e-6);
        }
      }
    }
  });

  it("clips a line to separate runs", () => {
    const runs = clipLine([{ x: -5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 8 }, { x: -5, y: 8 }], false, { x: 0, y: 0, width: 10, height: 10 });
    expect(runs).toHaveLength(2);
  });

  it("writes a real PDF with an A4 media box and a 1:1 SVG", () => {
    const options = { reference: "BR-000123" };
    const bytes = patternPdf(large, options);
    const pdf = Buffer.from(bytes).toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("/MediaBox [0 0 595.276 841.89]");
    expect(pdf).toContain("DRAFT PATTERN");
    const svg = patternSvg(large, options);
    expect(svg).toContain('width="210mm"');
    expect(svg).toContain("DRAFT PATTERN");
    expect(svg).not.toMatch(/ready to cut[^.]*\.\s*$/);
  });

  it("escapes design text in the SVG", () => {
    const svg = patternSvg(design([piece({ name: "<script>" })], { depth: 0 }), { reference: "BR-1" });
    expect(svg).not.toContain("<script>");
  });
});

describe("makeability thresholds", () => {
  it("keeps every library design and part free of blockers", () => {
    for (const group of INSPIRATION) {
      for (const entry of group.designs) expect(checkDesign(entry.build(newId)).filter((item) => item.level === "blocker"), entry.key).toEqual([]);
    }
    const start = applyPart(blankDesign(), "body-satchel", null, newId);
    if ("error" in start) throw new Error(start.error);
    for (const category of PART_CATEGORIES) {
      for (const part of category.parts) {
        const placed = applyPart(start.design, part.key, null, newId);
        if (!("error" in placed)) expect(checkDesign(placed.design).filter((item) => item.level === "blocker"), part.key).toEqual([]);
      }
    }
  });

  it("gives each finding a piece id and a fix", () => {
    const findings = checkDesign(design([piece({ hardware: [fitting({ x: 500, y: 0 })] })]));
    expect(findings.length).toBeGreaterThan(0);
    for (const item of findings) {
      expect(item.pieceId).toBe("body");
      expect(item.fix.length).toBeGreaterThan(0);
    }
  });

  it("warns on a handle below the minimum width and passes at it", () => {
    const at = (width: number) => found(checkDesign(design([piece({ points: rect(0, 0, 200, 150) }), tube("handle", [[-60, -70], [60, -70]], { tubeWidth: width })])), "narrow");
    expect(at(RULES.minHandleWidthMm - 1)?.level).toBe("warning");
    expect(at(RULES.minHandleWidthMm)).toBeUndefined();
  });

  it("scales the handle need with bag volume", () => {
    const big = design([piece({ points: rect(0, 0, 500, 400) }), tube("handle", [[-60, -190], [60, -190]], { tubeWidth: 16 })], { depth: 200 });
    expect(found(checkDesign(big), "narrow")).toBeDefined();
  });

  it("warns on a strap narrow for the bag, but not on a wallet or a chain", () => {
    const strap = (overrides: Partial<BespokePiece> = {}) => tube("strap", [[-150, -90], [-150, -500], [150, -500], [150, -90]], { tubeWidth: 12, ...overrides });
    expect(found(checkDesign(design([piece(), strap()])), "strap")?.level).toBe("warning");
    expect(found(checkDesign(design([piece(), strap()], { productType: "wallet" })), "strap")).toBeUndefined();
    expect(found(checkDesign(design([piece(), strap({ tubeStyle: "chain" })])), "strap")).toBeUndefined();
  });

  it("measures a tight curve and flags it in two steps", () => {
    const blob = (radius: number) => piece({ points: starterPoints("circle", radius * 2, radius * 2) });
    expect(tightestCurveRadius(blob(50))).toBeGreaterThan(40);
    expect(tightestCurveRadius(blob(50))).toBeLessThan(60);
    expect(tightestCurveRadius(piece())).toBe(Infinity);
    const tight = design([piece({ points: [{ x: -100, y: -100, smooth: false }, { x: 100, y: -100, smooth: false }, { x: 100, y: 99, smooth: true }, { x: 104, y: 103, smooth: true }, { x: 100, y: 106, smooth: true }, { x: -100, y: 100, smooth: false }] })]);
    expect(found(checkDesign(tight), "radius")).toBeDefined();
  });

  it("flags an acute corner", () => {
    const spike = piece({ points: [{ x: 0, y: -150, smooth: false }, { x: 30, y: 100, smooth: false }, { x: -30, y: 100, smooth: false }] });
    expect(found(checkDesign(design([spike])), "corner")?.level).toBe("warning");
  });

  it("measures a diagonal strip by its true width, not its box", () => {
    const angle = Math.PI / 4;
    const turn = (x: number, y: number) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle), smooth: false });
    const strip = piece({ points: [turn(-150, -5), turn(150, -5), turn(150, 5), turn(-150, 5)] });
    expect(narrowestWidth(outlineOf(strip))).toBeCloseTo(10, 0);
    const thin = found(checkDesign(design([strip])), "thin");
    expect(thin?.level).toBe("warning");
  });

  it("finds a neck in a wide piece", () => {
    const neck = [[-100, -100], [100, -100], [100, -4], [4, -4], [4, 4], [100, 4], [100, 100], [-100, 100], [-100, 4], [-4, 4], [-4, -4], [-100, -4]].map(([x, y]) => ({ x: x!, y: y!, smooth: false }));
    expect(narrowestWidth(outlineOf(piece({ points: neck })))).toBeLessThan(12);
  });

  it("blocks a sliver and warns at the middle band", () => {
    const at = (height: number) => found(checkDesign(design([piece({ points: rect(0, 0, 200, height) })], { depth: 0 })), "thin");
    expect(at(RULES.tooNarrowToCutMm - 2)?.level).toBe("blocker");
    expect(at(RULES.minPieceWidthMm - 2)?.level).toBe("warning");
    expect(at(RULES.minPieceWidthMm + 2)).toBeUndefined();
  });

  it("measures a ring by the band around its opening", () => {
    const hole = piece({ id: "hole", name: "Opening", holeOf: "body", stitched: false, points: rect(0, 0, 292, 192) });
    expect(found(checkDesign(design([piece(), hole])), "thin")?.level).toBe("blocker");
  });

  it("flags a stitch line that cannot follow the edge", () => {
    const narrow = piece({ points: rect(0, 0, 200, 10) });
    expect(found(checkDesign(design([narrow], { depth: 0 })), "stitch")?.level).toBe("warning");
    expect(found(checkDesign(design([piece({ points: starterPoints("rounded", 300, 220) })])), "stitch")).toBeUndefined();
  });

  it("flags a long span on the body and a long overhang on a flap", () => {
    expect(found(checkDesign(design([piece({ points: rect(0, 0, RULES.unsupportedSpanMm + 10, 200) })])), "span")).toBeDefined();
    const flap = piece({ id: "flap", name: "Flap", stack: 1, points: rect(0, 100 + RULES.unsupportedOverhangMm / 2, 200, RULES.unsupportedOverhangMm + 40) });
    expect(found(checkDesign(design([piece(), flap])), "overhang")?.pieceId).toBe("flap");
  });

  it("warns on a small gap from the body and blocks a far one", () => {
    const pocket = (x: number) => piece({ id: "pocket", name: "Pocket", stack: 1, points: rect(x, 0, 100, 80) });
    expect(found(checkDesign(design([piece(), pocket(0)])), "loose")).toBeUndefined();
    expect(found(checkDesign(design([piece(), pocket(220)])), "loose")?.level).toBe("warning");
    expect(found(checkDesign(design([piece(), pocket(400)])), "loose")?.level).toBe("blocker");
  });

  it("accepts a piece joined to the body through another piece", () => {
    const tab = piece({ id: "tab", name: "Tab", stack: 1, points: rect(170, 0, 60, 40) });
    const keeper = piece({ id: "keep", name: "Keeper", stack: 2, points: rect(230, 0, 80, 30) });
    expect(found(checkDesign(design([piece(), tab, keeper])), "loose")).toBeUndefined();
  });

  it("measures the real gap, not bounding boxes", () => {
    const stroke = { line: [{ x: 0, y: 0 }, { x: 100, y: 100 }], closed: false, reach: 0 };
    const dot = { line: [{ x: 100, y: 0 }, { x: 100, y: 1 }], closed: false, reach: 5 };
    expect(shapeGap(stroke, dot)).toBeGreaterThan(60);
  });

  it("ignores pieces on other faces for the touch check", () => {
    expect(found(checkDesign(design([piece(), piece({ id: "back", name: "Back pocket", view: "back", points: rect(500, 0, 100, 80) })])), "loose")).toBeUndefined();
  });

  it("warns on heavy hide use and blocks past one hide, with wastage", () => {
    const side = (dm2: number) => Math.sqrt((dm2 / HIDE_WASTAGE) * 10_000);
    const flat = (dm2: number) => {
      const s = side(dm2);
      return piece({ points: rect(0, 0, s * 2, s / 2), stitched: false });
    };
    expect(found(checkDesign(design([flat(RULES.warnHideAreaDm2 + 5)], { depth: 0 })), "area")?.level).toBe("warning");
    expect(found(checkDesign(design([flat(RULES.maxHideAreaDm2 + 5)], { depth: 0 })), "area")?.level).toBe("blocker");
    expect(found(checkDesign(design([piece()])), "area")).toBeUndefined();
  });

  it("blocks hardware off the leather, inside a hole or off a handle", () => {
    expect(found(checkDesign(design([piece({ hardware: [fitting({ x: 400 })] })])), "fit")?.level).toBe("blocker");
    expect(found(checkDesign(design([piece({ hardware: [fitting({ x: 150 + RULES.hardwareOffLeatherToleranceMm - 1 })] })])), "fit")).toBeUndefined();
    const hole = piece({ id: "hole", name: "Window", holeOf: "body", stitched: false, points: rect(0, 0, 60, 60) });
    expect(found(checkDesign(design([piece({ hardware: [fitting()] }), hole])), "fit")?.level).toBe("blocker");
    const off = tube("handle", [[-60, -90], [60, -90]], { hardware: [fitting({ x: 0, y: -160 })] });
    expect(found(checkDesign(design([piece(), off])), "fit")?.pieceId).toBe("handle");
  });

  it("leaves hidden pieces out", () => {
    expect(checkDesign(design([piece(), piece({ id: "gone", name: "Gone", visible: false, points: rect(900 - 200, 0, 8, 8) })])).filter((item) => item.pieceId === "gone")).toEqual([]);
  });

  it("stops a blocked design in the shared check and on the server parse", () => {
    const blocked = design([piece({ hardware: [fitting({ x: 400 })] })]);
    expect(designProblem(blocked)).toContain("not on leather");
    const parsed = parseDesign(JSON.stringify(designSchema.parse(blocked)));
    expect("error" in parsed && parsed.error).toContain("not on leather");
    expect(designProblem(design([piece()]))).toBeNull();
  });
});

describe("logo on the cut sheet", () => {
  const logo: NonNullable<BespokePiece["logo"]> = { id: "11111111-1111-4111-8111-111111111111", x: 40, y: -20, width: 60, rotation: 0, style: "deboss", rightsConfirmed: true };

  it("marks the logo position and technique on the pattern and the printed sheet", () => {
    const pattern = buildPattern(design([piece({ logo })]));
    const marks = pattern.pieces.flatMap((item) => item.marks).map((mark) => mark.label);
    expect(marks).toContain("Logo, deboss");
    expect(JSON.stringify(patternSheets(pattern))).toContain("Logo, deboss");
  });
});
