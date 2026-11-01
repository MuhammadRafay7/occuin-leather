import { PATTERN } from "../config";
import { PdfDocument } from "../pdf";
import type { Vec } from "../outline";
import type { Pattern, PatternLine, PatternPiece } from "./pattern";

type PathOp = { kind: "path"; points: Vec[]; closed: boolean; stroke: string; width: number; dash?: [number, number] };
type TextOp = { kind: "text"; value: string; x: number; y: number; size: number; color: string; bold: boolean };
export type SheetOp = PathOp | TextOp;
export type Sheet = { ops: SheetOp[]; title: string };
type Rect = { x: number; y: number; width: number; height: number };

const INK = "#14201c";
const MUTED = "#555555";
const SEAM = "#777777";
const STITCH = "#b0702a";
const FOLD = "#2255aa";
const CHECK = "#1f43a0";
const REGISTRATION = "#a01f6a";
const DANGER = "#b3261e";

const { widthMm: PAGE_W, heightMm: PAGE_H, marginMm, headerMm, footerMm, gapMm, labelMm, overlapMm, checkSquareMm } = PATTERN.sheet;
export const FRAME: Rect = { x: marginMm, y: headerMm, width: PAGE_W - marginMm * 2, height: PAGE_H - headerMm - footerMm };
const CHECK_STEP_MM = 10;
const CHARS_PER_EM = 0.5;
const SVG_PAGE_GAP_MM = 10;

export const DRAFT_NOTICE = "DRAFT PATTERN for the workshop to confirm. Not ready to cut until reviewed.";

const path = (points: Vec[], closed: boolean, stroke: string, width: number, dash?: [number, number]): PathOp => ({ kind: "path", points, closed, stroke, width, ...(dash ? { dash } : {}) });
const text = (value: string, x: number, y: number, size: number, color = INK, bold = false): TextOp => ({ kind: "text", value, x, y, size, color, bold });
const rectPoints = ({ x, y, width, height }: Rect) => [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
const textWidth = (op: TextOp) => op.value.length * op.size * CHARS_PER_EM;

function clipSegment(a: Vec, b: Vec, rect: Rect): [Vec, Vec] | null {
  let enter = 0;
  let leave = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const edges: [number, number][] = [[-dx, a.x - rect.x], [dx, rect.x + rect.width - a.x], [-dy, a.y - rect.y], [dy, rect.y + rect.height - a.y]];
  for (const [direction, room] of edges) {
    if (direction === 0) {
      if (room < 0) return null;
      continue;
    }
    const t = room / direction;
    if (direction < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return null;
  }
  return [{ x: a.x + dx * enter, y: a.y + dy * enter }, { x: a.x + dx * leave, y: a.y + dy * leave }];
}

export function clipLine(points: Vec[], closed: boolean, rect: Rect) {
  const line = closed ? [...points, points[0]!] : points;
  const runs: Vec[][] = [];
  let run: Vec[] = [];
  for (let i = 1; i < line.length; i++) {
    const kept = clipSegment(line[i - 1]!, line[i]!, rect);
    if (!kept) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    const [from, to] = kept;
    const last = run[run.length - 1];
    if (!last || Math.hypot(last.x - from.x, last.y - from.y) > 1e-6) {
      if (run.length > 1) runs.push(run);
      run = [from];
    }
    run.push(to);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

function arrowHead(tip: Vec, from: Vec): Vec[] {
  const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / length;
  const uy = (tip.y - from.y) / length;
  return [{ x: tip.x - ux * 4 - uy * 2, y: tip.y - uy * 4 + ux * 2 }, tip, { x: tip.x - ux * 4 + uy * 2, y: tip.y - uy * 4 - ux * 2 }];
}

function pieceOps(piece: PatternPiece, seamAllowance: number): SheetOp[] {
  const ops: SheetOp[] = [
    text(`${piece.code}  ${piece.name}`.slice(0, 80), 0, -6.6, 3.2, INK, true),
    text(`Cut ${piece.quantity} x, ${piece.leather}, ${Math.round(piece.width)} x ${Math.round(piece.height)} mm, seam ${seamAllowance} mm`.slice(0, 96), 0, -2.4, 2.6, MUTED),
    path(piece.cut, true, INK, 0.3),
    ...piece.cutHoles.map((hole) => path(hole, true, INK, 0.3)),
  ];
  if (seamAllowance > 0) ops.push(path(piece.seam, true, SEAM, 0.15, [3, 2]), ...piece.seamHoles.map((hole) => path(hole, true, SEAM, 0.15, [3, 2])));
  ops.push(...piece.stitches.map((line: PatternLine) => path(line.points, line.closed, STITCH, 0.15, [1.4, 1.4])));
  ops.push(...piece.folds.map((line) => path(line.points, false, FOLD, 0.2, [4, 2])));
  for (const notch of piece.notches) {
    const outer = { x: notch.at.x + notch.normal.x * seamAllowance, y: notch.at.y + notch.normal.y * seamAllowance };
    const inner = { x: notch.at.x - notch.normal.x * PATTERN.notchInsideMm, y: notch.at.y - notch.normal.y * PATTERN.notchInsideMm };
    ops.push(path([outer, inner], false, notch.kind === "handle" ? REGISTRATION : INK, notch.kind === "handle" ? 0.45 : 0.3));
  }
  const { from, to } = piece.grain;
  ops.push(path([from, to], false, INK, 0.2), path(arrowHead(to, from), false, INK, 0.2), path(arrowHead(from, to), false, INK, 0.2));
  ops.push(text("Grain", to.x + 2, to.y + 1, 2.4, MUTED), text(piece.code, from.x + 3, from.y + 7, 6, INK, true));
  for (const mark of piece.marks) {
    ops.push(path([{ x: mark.at.x - 3, y: mark.at.y }, { x: mark.at.x + 3, y: mark.at.y }], false, INK, 0.2), path([{ x: mark.at.x, y: mark.at.y - 3 }, { x: mark.at.x, y: mark.at.y + 3 }], false, INK, 0.2));
    ops.push(text(mark.label.slice(0, 40), mark.at.x + 4, mark.at.y - 1, 2.4));
  }
  return ops;
}

const moveOp = (op: SheetOp, dx: number, dy: number): SheetOp =>
  op.kind === "text" ? { ...op, x: op.x + dx, y: op.y + dy } : { ...op, points: op.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };

function clipOps(ops: SheetOp[], rect: Rect): SheetOp[] {
  return ops.flatMap((op): SheetOp[] => {
    if (op.kind === "text") return op.x >= rect.x && op.y >= rect.y && op.x + textWidth(op) <= rect.x + rect.width && op.y <= rect.y + rect.height ? [op] : [];
    return clipLine(op.points, op.closed, rect).map((points) => ({ ...op, points, closed: false }));
  });
}

function squareClashes(ops: SheetOp[], square: Rect) {
  let clashes = 0;
  for (const op of ops) {
    if (op.kind === "text") {
      const overlap = op.x < square.x + square.width && op.x + textWidth(op) > square.x && op.y > square.y && op.y - op.size < square.y + square.height;
      if (overlap) clashes += 2;
    } else {
      clashes += clipLine(op.points, op.closed, square).length;
    }
  }
  return clashes;
}

export function placeCheckSquare(ops: SheetOp[]) {
  let best = { x: FRAME.x, y: FRAME.y + FRAME.height - checkSquareMm, clashes: Infinity };
  const label = 8;
  for (let y = FRAME.y + FRAME.height - checkSquareMm; y >= FRAME.y + label; y -= CHECK_STEP_MM) {
    for (let x = FRAME.x + FRAME.width - checkSquareMm; x >= FRAME.x; x -= CHECK_STEP_MM) {
      const clashes = squareClashes(ops, { x: x - 1, y: y - label, width: checkSquareMm + 2, height: checkSquareMm + label + 1 });
      if (clashes < best.clashes) best = { x, y, clashes };
      if (!clashes) return best;
    }
  }
  return best;
}

function checkSquareOps({ x, y }: { x: number; y: number }): SheetOp[] {
  return [
    path(rectPoints({ x, y, width: checkSquareMm, height: checkSquareMm }), true, CHECK, 0.25),
    text("100 mm check square, not a pattern piece.", x, y - 4.4, 2.5, CHECK, true),
    text("Measure it. If it is not 100 mm, reprint at 100%.", x, y - 1.2, 2.5, CHECK),
  ];
}

function coverLines(pattern: Pattern) {
  type Line = { value: string; size?: number; bold?: boolean; color?: string; gap?: number };
  const lines: Line[] = [];
  const heading = (value: string) => lines.push({ value, size: 3.8, bold: true, gap: 3 });
  const body = (value: string, color?: string) => {
    const size = 2.9;
    const limit = Math.floor(FRAME.width / (size * CHARS_PER_EM));
    let rest = value;
    while (rest.length > limit) {
      const cut = rest.lastIndexOf(" ", limit);
      const end = cut > 0 ? cut : limit;
      lines.push({ value: rest.slice(0, end), ...(color ? { color } : {}) });
      rest = rest.slice(end).trimStart();
    }
    lines.push({ value: rest, ...(color ? { color } : {}) });
  };
  lines.push({ value: `Pattern ${pattern.reference}`, size: 7, bold: true, gap: 2 });
  body(`Product: ${pattern.product}${pattern.name ? `, ${pattern.name}` : ""}`);
  body(`Depth ${pattern.depthMm} mm, seam allowance ${pattern.seamAllowanceMm} mm, hardware ${pattern.metal}, lining ${pattern.lining}${pattern.closure ? `, closure ${pattern.closure}` : ""}`);
  body("Key: solid line cut, grey dashes finished edge, brown dashes stitch line, ticks notches, pink ticks handle positions, crosses fittings.");
  heading(`Pieces (${pattern.pieces.length})`);
  for (const piece of pattern.pieces) body(`${piece.code}: ${piece.quantity} x ${piece.name}, ${piece.leather}, ${Math.round(piece.width)} x ${Math.round(piece.height)} mm, ${(piece.areaMm2 / 10_000).toFixed(2)} dm2`);
  heading("Hide area");
  for (const line of pattern.hide) body(`${line.leather}: ${line.netDm2.toFixed(1)} dm2 cut, ${line.withWastageDm2.toFixed(1)} dm2 with wastage, about ${line.squareFeet.toFixed(1)} sq ft`);
  body(`Total: ${pattern.totalNetDm2.toFixed(1)} dm2 cut, ${pattern.totalWithWastageDm2.toFixed(1)} dm2 at ${pattern.wastage} times for wastage.`);
  if (pattern.hardware.length) {
    heading("Hardware");
    for (const item of pattern.hardware) body(`${item.quantity} x ${item.name}, ${item.metal}`);
  }
  if (pattern.thread.length) {
    heading("Thread");
    for (const line of pattern.thread) body(`${line.thread}: about ${line.lengthM.toFixed(1)} m for ${(line.stitchedMm / 1000).toFixed(1)} m of stitching`);
  }
  if (pattern.surface.length) {
    heading("Text");
    pattern.surface.forEach((line) => body(line));
  }
  heading("Makeability check, guidance from estimates");
  if (!pattern.findings.length) body("Nothing flagged. The workshop still confirms the design.");
  for (const item of pattern.findings) body(`${item.level === "blocker" ? "Must fix" : "Check"}: ${item.title}. ${item.fix}`, item.level === "blocker" ? DANGER : undefined);
  if (pattern.notes.length) {
    heading("Notes");
    pattern.notes.forEach((line) => body(line));
  }
  return lines;
}

function coverSheets(pattern: Pattern): Sheet[] {
  const bottom = FRAME.y + FRAME.height - checkSquareMm - 10;
  const sheets: Sheet[] = [{ ops: [], title: "Cover" }];
  let y = FRAME.y + 4;
  for (const line of coverLines(pattern)) {
    const size = line.size ?? 2.9;
    const room = size * 1.45 + (line.gap ?? 0);
    if (y + room > bottom) {
      sheets.push({ ops: [], title: "Cover, continued" });
      y = FRAME.y + 4;
    }
    y += room;
    sheets[sheets.length - 1]!.ops.push(text(line.value, FRAME.x, y, size, line.color ?? INK, line.bold ?? false));
  }
  return sheets;
}

const blockHeight = (piece: PatternPiece) => piece.height + labelMm;
const fitsOnePage = (piece: PatternPiece) => piece.width <= FRAME.width && blockHeight(piece) <= FRAME.height;

function packPage(queue: PatternPiece[]) {
  const placed: { piece: PatternPiece; x: number; y: number }[] = [];
  const rest: PatternPiece[] = [];
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const piece of queue) {
    let nextX = x;
    let nextY = y;
    if (nextX + piece.width > FRAME.width) {
      nextX = 0;
      nextY = y + shelf + gapMm;
    }
    if (nextY + blockHeight(piece) > FRAME.height) {
      rest.push(piece);
      continue;
    }
    if (nextY !== y) shelf = 0;
    placed.push({ piece, x: nextX, y: nextY });
    x = nextX + piece.width + gapMm;
    y = nextY;
    shelf = Math.max(shelf, blockHeight(piece));
  }
  return { placed, rest };
}

function packedSheets(pieces: PatternPiece[], seam: number): Sheet[] {
  const sheets: Sheet[] = [];
  let queue = [...pieces].sort((a, b) => blockHeight(b) - blockHeight(a));
  while (queue.length) {
    const { placed, rest } = packPage(queue);
    queue = rest;
    const opsFor = (items: typeof placed) => items.flatMap(({ piece, x, y }) => pieceOps(piece, seam).map((op) => moveOp(op, FRAME.x + x, FRAME.y + y + labelMm)));
    while (placed.length > 1 && placeCheckSquare(opsFor(placed)).clashes) queue.unshift(placed.pop()!.piece);
    sheets.push({ ops: opsFor(placed), title: placed.map(({ piece }) => piece.code).join(", ") });
  }
  return sheets;
}

function registrationOps(x: number, y: number): SheetOp[] {
  const arm = 4;
  return [path([{ x: x - arm, y }, { x: x + arm, y }], false, REGISTRATION, 0.2), path([{ x, y: y - arm }, { x, y: y + arm }], false, REGISTRATION, 0.2), path([{ x: x - 2, y: y - 2 }, { x: x + 2, y: y - 2 }, { x: x + 2, y: y + 2 }, { x: x - 2, y: y + 2 }], true, REGISTRATION, 0.15)];
}

export function tileGrid(width: number, height: number) {
  const stepX = FRAME.width - overlapMm;
  const stepY = FRAME.height - overlapMm;
  return { stepX, stepY, cols: Math.max(1, Math.ceil((width - overlapMm) / stepX)), rows: Math.max(1, Math.ceil((height - overlapMm) / stepY)) };
}

function tiledSheets(piece: PatternPiece, seam: number): Sheet[] {
  const { stepX, stepY, cols, rows } = tileGrid(piece.width + overlapMm, blockHeight(piece) + overlapMm);
  const block = pieceOps(piece, seam).map((op) => moveOp(op, overlapMm, labelMm + overlapMm));
  const sheets: Sheet[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const window = { x: col * stepX, y: row * stepY, width: FRAME.width, height: FRAME.height };
      const ops = clipOps(block, window).map((op) => moveOp(op, FRAME.x - window.x, FRAME.y - window.y));
      for (const k of [col, col + 1]) {
        for (const m of [row, row + 1]) ops.push(...registrationOps(FRAME.x + (k - col) * stepX + overlapMm / 2, FRAME.y + (m - row) * stepY + overlapMm / 2));
      }
      ops.push(path(rectPoints(FRAME), true, "#cccccc", 0.1));
      sheets.push({ ops, title: `Piece ${piece.code}, row ${row + 1} of ${rows}, column ${col + 1} of ${cols}. Lay the pink marks of neighbouring sheets over each other.` });
    }
  }
  return sheets;
}

export function patternSheets(pattern: Pattern): Sheet[] {
  const single = pattern.pieces.filter(fitsOnePage);
  const large = pattern.pieces.filter((piece) => !fitsOnePage(piece));
  const sheets = [...coverSheets(pattern), ...packedSheets(single, pattern.seamAllowanceMm), ...large.flatMap((piece) => tiledSheets(piece, pattern.seamAllowanceMm))];
  return sheets.map((sheet, index) => {
    const square = placeCheckSquare(sheet.ops);
    return {
      title: sheet.title,
      ops: [
        text(DRAFT_NOTICE, marginMm, 8, 3.1, DANGER, true),
        text(`${pattern.reference}. ${sheet.title}`.slice(0, 130), marginMm, 13, 2.5, MUTED),
        ...sheet.ops,
        ...checkSquareOps(square),
        text(`Page ${index + 1} of ${sheets.length}. 1:1 scale, print at 100% with no fit to page.`, marginMm, PAGE_H - 7, 2.5, MUTED),
      ],
    };
  });
}

export function sheetsToPdf(sheets: Sheet[]) {
  const pdf = new PdfDocument();
  for (const sheet of sheets) {
    const page = pdf.addPage(PAGE_W, PAGE_H);
    for (const op of sheet.ops) {
      if (op.kind === "text") {
        page.text(op.value, op.x, op.y, op.size, op.color, op.bold);
        continue;
      }
      const [start, ...rest] = op.points;
      if (!start) continue;
      const subpath = { start, curves: rest.map((point) => ({ c1: point, c2: point, b: point })), closed: op.closed };
      page.shape([subpath], { stroke: op.stroke, width: op.width, ...(op.dash ? { dash: op.dash } : {}) });
    }
  }
  return pdf.render();
}

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
const mm = (value: number) => value.toFixed(3).replace(/\.?0+$/, "");

function svgOp(op: SheetOp) {
  if (op.kind === "text") return `<text x="${mm(op.x)}" y="${mm(op.y)}" font-size="${mm(op.size)}" fill="${op.color}"${op.bold ? ' font-weight="700"' : ""}>${escapeXml(op.value)}</text>`;
  const d = `M${op.points.map((point) => `${mm(point.x)} ${mm(point.y)}`).join("L")}${op.closed ? "Z" : ""}`;
  return `<path d="${d}" fill="none" stroke="${op.stroke}" stroke-width="${mm(op.width)}"${op.dash ? ` stroke-dasharray="${op.dash.join(" ")}"` : ""}/>`;
}

export function sheetsToSvg(sheets: Sheet[], title: string) {
  const height = sheets.length * (PAGE_H + SVG_PAGE_GAP_MM) - SVG_PAGE_GAP_MM;
  const pages = sheets.map((sheet, index) => `<g id="page-${index + 1}" transform="translate(0 ${index * (PAGE_H + SVG_PAGE_GAP_MM)})"><rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff" stroke="#cccccc" stroke-width="0.1"/>${sheet.ops.map(svgOp).join("")}</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${height}mm" viewBox="0 0 ${PAGE_W} ${height}" font-family="Helvetica, Arial, sans-serif"><title>${escapeXml(title)}</title>${pages.join("")}</svg>`;
}
