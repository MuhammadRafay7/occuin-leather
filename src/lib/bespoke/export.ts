import { COLORS, FINISHES, METALS, THREADS } from "../studio/spec";
import { HARDWARE, PRODUCT_TYPES, TEXT_TECHNIQUES, VIEWS, type BespokeDesign, type BespokePiece } from "./design";
import type { StudioPricing } from "../studio/pricing";
import { estimateDesign, hardwareList, visibleDesign } from "./estimate";
import { bodyOf, boundsOf, cubics, fullPoints, groupBounds, holesFor, isSolidPanel, layerOrder, netArea, outlineOf, pathLength, perimeter, piecePath, stitchRuns, type Vec } from "./outline";
import { PdfDocument, type PdfPage, type PdfSubpath } from "./pdf";

const MARGIN_MM = 10;
const A4 = { width: 210, height: 297 };
const INK = "#14201c";
const STITCH = "#b0702a";

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
const threadHex = (piece: BespokePiece) => THREADS[piece.thread].hex || "#d9cdb8";
const runPath = (points: Vec[], ring: boolean) => `M${points.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}${ring ? "Z" : ""}`;

function svgHardware(item: BespokePiece["hardware"][number], color: string) {
  const length = item.kind === "zip" ? item.length : 30;
  return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation})"><rect x="${-length / 2}" y="-6" width="${length}" height="12" rx="3" fill="${color}"/></g>`;
}

function svgPiece(piece: BespokePiece, design: BespokeDesign) {
  const metal = METALS[design.metal].hex;
  if (piece.kind === "tube") {
    return `<path d="${piecePath(piece)}" fill="none" stroke="${COLORS[piece.color].hex}" stroke-width="${piece.tubeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (piece.holeOf) return "";
  const holes = holesFor(piece, design.pieces);
  const d = [piecePath(piece), ...holes.map(piecePath)].join(" ");
  const stitches = piece.stitched
    ? stitchRuns(outlineOf(piece), holes.map(outlineOf)).map((run) => `<path d="${runPath(run.points, run.ring)}" fill="none" stroke="${threadHex(piece)}" stroke-width="0.7" stroke-dasharray="2.6 1.4"/>`).join("")
    : "";
  return `<path d="${d}" fill="${COLORS[piece.color].hex}" fill-rule="evenodd" stroke="#00000055" stroke-width="0.4"/>${stitches}${piece.hardware.map((item) => svgHardware(item, metal)).join("")}`;
}

export function designSvg(source: BespokeDesign, background: string | null = null) {
  const design = visibleDesign(source);
  const solid = design.pieces.filter((piece) => isSolidPanel(piece) || piece.kind === "tube");
  if (!solid.length) return null;
  const box = groupBounds(solid);
  const x = box.minX - MARGIN_MM;
  const y = box.minY - MARGIN_MM;
  const width = box.width + MARGIN_MM * 2;
  const height = box.height + MARGIN_MM * 2;
  const name = escapeXml(design.name || "OCCUIN design");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="${x} ${y} ${width} ${height}"><title>${name}</title>${background ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${background}"/>` : ""}${layerOrder(design.pieces).map((piece) => svgPiece(piece, design)).join("")}</svg>`;
}

const subpaths = (piece: BespokePiece, map: (point: Vec) => Vec): PdfSubpath[] => {
  const curves = cubics(fullPoints(piece), piece.closed);
  if (!curves.length) return [];
  return [{ start: map(curves[0]!.a), curves: curves.map(({ c1, c2, b }) => ({ c1: map(c1), c2: map(c2), b: map(b) })), closed: piece.closed }];
};

const polyPath = (points: Vec[], closed: boolean, map: (point: Vec) => Vec): PdfSubpath => ({
  start: map(points[0]!),
  curves: points.slice(1).map((point) => {
    const at = map(point);
    return { c1: at, c2: at, b: at };
  }),
  closed,
});

function pieceFull(design: BespokeDesign, piece: BespokePiece, map: (point: Vec) => Vec, width: number) {
  return [...subpaths(piece, map), ...holesFor(piece, design.pieces).flatMap((hole) => subpaths(hole, map))].map((path) => ({ path, width }));
}

const leatherLabel = (piece: BespokePiece) => `${COLORS[piece.color].name} ${FINISHES[piece.finish].name.toLowerCase()}`;

function summary(page: PdfPage, design: BespokeDesign, pricing: StudioPricing | undefined, title: string, reference?: string) {
  const estimate = estimateDesign(design, pricing);
  page.text(title, 15, 22, 7, INK, true);
  let y = 32;
  const row = (label: string, value: string) => {
    page.text(label, 15, y, 3.4, "#555555");
    page.text(value, 55, y, 3.4);
    y += 5.6;
  };
  if (reference) row("Reference", reference);
  row("Product", PRODUCT_TYPES[design.productType]);
  if (design.name) row("Name", design.name.slice(0, 70));
  if (estimate) row("Overall size", `${estimate.widthMm} x ${estimate.heightMm} x ${estimate.depthMm} mm`);
  if (estimate) row("Leather area", `${estimate.areaDm2.toFixed(1)} dm2`);
  row("Hardware metal", METALS[design.metal].name);
  row("Lining", COLORS[design.lining].name);
  if (design.closure) row("Closure", design.closure.slice(0, 80));
  return y + 3;
}

function fitPlan(page: PdfPage, design: BespokeDesign, top: number) {
  const solid = design.pieces.filter((piece) => isSolidPanel(piece) || piece.kind === "tube");
  const box = groupBounds(solid);
  const room = { width: A4.width - 30, height: Math.max(40, A4.height - top - 90) };
  const scale = Math.min(room.width / box.width, room.height / box.height, 1);
  const map = ({ x, y }: Vec) => ({ x: 15 + (x - box.minX) * scale, y: top + (y - box.minY) * scale });
  for (const piece of layerOrder(design.pieces)) {
    if (piece.kind === "tube") {
      page.shape(subpaths(piece, map), { stroke: COLORS[piece.color].hex, width: Math.max(0.4, piece.tubeWidth * scale) });
    } else if (!piece.holeOf) {
      page.shape(pieceFull(design, piece, map, 0.2).map(({ path }) => path), { fill: COLORS[piece.color].hex, stroke: "#333333", width: 0.15 });
    }
  }
  return top + box.height * scale + 8;
}

export function customerPdf(source: BespokeDesign, pricing?: StudioPricing) {
  const design = visibleDesign(source);
  const pdf = new PdfDocument();
  const page = pdf.addPage(A4.width, A4.height);
  let y = fitPlan(page, design, summary(page, design, pricing, design.name || "Your OCCUIN design"));
  page.text("Pieces", 15, y, 4, INK, true);
  y += 6;
  for (const piece of layerOrder(design.pieces).filter((item) => !item.holeOf).slice(0, Math.floor((A4.height - y - 15) / 5))) {
    page.text(`${piece.name}, ${leatherLabel(piece)}`.slice(0, 90), 15, y, 3.2);
    y += 5;
  }
  return pdf.render();
}

export function cutSheetPdf(source: BespokeDesign, reference: string, pricing?: StudioPricing) {
  const pdf = new PdfDocument();
  appendCutSheet(pdf, source, reference, pricing);
  return pdf.render();
}

export function appendCutSheet(pdf: PdfDocument, source: BespokeDesign, reference: string, pricing?: StudioPricing) {
  const design = visibleDesign(source);
  const page = pdf.addPage(A4.width, A4.height);
  let y = summary(page, design, pricing, `Cut sheet ${reference}`, reference);
  const body = bodyOf(design);
  const cuts: { label: string; quantity: number; detail: string }[] = [];
  for (const piece of layerOrder(design.pieces).filter((item) => !item.holeOf)) {
    const box = boundsOf(outlineOf(piece));
    const where = piece.view === "front" ? piece.name : `${piece.name} (${VIEWS[piece.view]})`;
    if (piece.kind === "tube") {
      cuts.push({ label: where, quantity: 1, detail: `${leatherLabel(piece)}, strip ${Math.round(pathLength(outlineOf(piece)))} x ${Math.round(piece.tubeWidth * 2.4)} mm, thread ${THREADS[piece.thread].name}` });
    } else {
      const holes = holesFor(piece, design.pieces).length;
      cuts.push({ label: where, quantity: 1, detail: `${leatherLabel(piece)}, ${Math.round(box.width)} x ${Math.round(box.height)} mm, ${(netArea(piece, design.pieces) / 10_000).toFixed(2)} dm2${holes ? `, ${holes} cut-out${holes > 1 ? "s" : ""}` : ""}, thread ${piece.stitched ? THREADS[piece.thread].name : "none"}` });
    }
    if (piece === body && design.depth) {
      cuts.push({ label: `${piece.name} back`, quantity: 1, detail: `${leatherLabel(piece)}, same outline, ${Math.round(box.width)} x ${Math.round(box.height)} mm` });
      cuts.push({ label: `${piece.name} side wall`, quantity: 1, detail: `${leatherLabel(piece)}, strip ${Math.round(perimeter(outlineOf(piece)))} x ${design.depth} mm` });
    }
  }
  page.text("Cuts and quantities", 15, y, 4, INK, true);
  y += 6;
  for (const cut of cuts.slice(0, 34)) {
    page.text(`${cut.quantity} x ${cut.label}: ${cut.detail}`.slice(0, 104), 15, y, 2.9);
    y += 4.4;
  }
  y += 3;
  const fittings = hardwareList(design);
  if (fittings.length) {
    page.text("Hardware", 15, y, 4, INK, true);
    y += 6;
    for (const item of fittings) {
      page.text(`${item.quantity} x ${item.name}, ${METALS[design.metal].name}`, 15, y, 2.9);
      y += 4.4;
    }
  }
  for (const piece of design.pieces.filter((item) => item.logo)) {
    page.text(`Logo on ${piece.name}: ${piece.logo!.width} mm wide, ${piece.logo!.style}, rights ${piece.logo!.rightsConfirmed ? "confirmed by customer" : "not confirmed"}`.slice(0, 100), 15, Math.min(y, 285), 2.9);
    y += 4.4;
  }
  const texts = design.pieces.filter((piece) => piece.text);
  for (const piece of texts) {
    page.text(`Text on ${piece.name}: ${piece.text!.value}, ${TEXT_TECHNIQUES[piece.text!.technique].toLowerCase()}`.slice(0, 100), 15, Math.min(y, 285), 2.9);
    y += 4.4;
  }

  for (const piece of layerOrder(design.pieces).filter((item) => !item.holeOf)) {
    const box = piece.kind === "tube" ? null : boundsOf(outlineOf(piece));
    if (!box) {
      const length = pathLength(outlineOf(piece));
      const strip = piece.tubeWidth * 2.4;
      const sheet = pdf.addPage(length + 40, strip + 50);
      sheet.text(`${reference} ${piece.name}, 1:1, ${leatherLabel(piece)}`.slice(0, 90), 10, 10, 3.4);
      const corner = (x: number, y2: number) => ({ x: x + 20, y: y2 + 20 });
      sheet.shape([polyPath([corner(0, 0), corner(length, 0), corner(length, strip), corner(0, strip)], true, (point) => point)], { stroke: INK, width: 0.25 });
      scaleBar(sheet, 20, strip + 35);
      continue;
    }
    const sheetWidth = Math.max(box.width + MARGIN_MM * 4, 130);
    const sheetHeight = box.height + MARGIN_MM * 4 + 22;
    const sheet = pdf.addPage(sheetWidth, sheetHeight);
    const map = ({ x, y: py }: Vec) => ({ x: x - box.minX + MARGIN_MM * 2, y: py - box.minY + MARGIN_MM * 2 + 8 });
    sheet.text(`${reference} ${piece.name}, 1:1, ${leatherLabel(piece)}`.slice(0, 90), MARGIN_MM, 10, 3.4);
    sheet.shape(pieceFull(design, piece, map, 0.25).map(({ path }) => path), { stroke: INK, width: 0.25 });
    if (piece.stitched) {
      for (const run of stitchRuns(outlineOf(piece), holesFor(piece, design.pieces).map(outlineOf))) {
        sheet.shape([polyPath(run.points, run.ring, map)], { stroke: STITCH, width: 0.15, dash: [2, 2] });
      }
    }
    for (const item of piece.hardware) {
      const at = map(item);
      sheet.line(at.x - 3, at.y, at.x + 3, at.y);
      sheet.line(at.x, at.y - 3, at.x, at.y + 3);
      sheet.text(item.label || HARDWARE[item.kind].name, at.x + 4, at.y - 1, 2.6);
    }
    if (piece.fold) {
      const a = map({ x: piece.fold.ax, y: piece.fold.ay });
      const b = map({ x: piece.fold.bx, y: piece.fold.by });
      sheet.shape([polyPath([a, b], false, (point) => point)], { stroke: "#2255aa", width: 0.2, dash: [4, 2] });
    }
    scaleBar(sheet, MARGIN_MM, sheetHeight - 12);
  }
}

function scaleBar(page: PdfPage, x: number, y: number) {
  page.line(x, y, x + 100, y);
  page.line(x, y - 2, x, y + 2);
  page.line(x + 100, y - 2, x + 100, y + 2);
  page.text("100 mm, check print scale", x + 2, y - 2, 2.6);
}

