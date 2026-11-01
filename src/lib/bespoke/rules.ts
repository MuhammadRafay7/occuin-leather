import { HIDE_WASTAGE, RULES } from "./config";
import { HARDWARE, LOGO_STYLES, type BespokeDesign, type BespokePiece } from "./design";
import { measureDesign, visibleDesign } from "./estimate";
import { bodyOf, boundsOf, contains, crossesItself, holeOutlines, isSolidPanel, netArea, offsetInward, outlineOf, pathLength, perimeter, STITCH_INSET_MM, STITCH_PITCH_MM, stitchRuns, type Vec } from "./outline";
import { distanceToLine, narrowestWidth, shapeGap, tightestCurveRadius, type Shape } from "./production/geometry";

export type Finding = { id: string; level: "blocker" | "warning"; pieceId: string; title: string; fix: string };

function sharpestCorner(outline: Vec[]) {
  let smallest = 180;
  const count = outline.length;
  for (let i = 0; i < count; i++) {
    const a = outline[(i - 1 + count) % count]!;
    const b = outline[i]!;
    const c = outline[(i + 1) % count]!;
    const ux = a.x - b.x;
    const uy = a.y - b.y;
    const vx = c.x - b.x;
    const vy = c.y - b.y;
    const size = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (!size) continue;
    smallest = Math.min(smallest, (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / size))) * 180) / Math.PI);
  }
  return smallest;
}

const shapeOf = (piece: BespokePiece): Shape => ({ line: outlineOf(piece), closed: piece.closed, reach: piece.kind === "tube" ? piece.tubeWidth / 2 : 0 });

function offLeather(point: Vec, piece: BespokePiece, holes: Vec[][]) {
  const outline = outlineOf(piece);
  if (piece.kind === "tube") return distanceToLine(point, outline, false) > piece.tubeWidth / 2 + RULES.hardwareOffLeatherToleranceMm;
  if (holes.some((hole) => contains(hole, point))) return true;
  return !contains(outline, point) && distanceToLine(point, outline, true) > RULES.hardwareOffLeatherToleranceMm;
}

function hardwareFindings(piece: BespokePiece, holes: Vec[][]): Finding[] {
  return piece.hardware
    .filter((item) => offLeather(item, piece, holes))
    .map((item) => ({ id: `fit-${item.id}-${piece.id}`, level: "blocker", pieceId: piece.id, title: `${item.label || HARDWARE[item.kind].name} is not on leather`, fix: `Drag it back onto ${piece.name}.` }));
}

function stitchCoverage(outline: Vec[], holes: Vec[][]) {
  const planned = [offsetInward(outline, STITCH_INSET_MM), ...holes.map((hole) => offsetInward(hole, -STITCH_INSET_MM))].reduce((sum, line) => sum + Math.floor(perimeter(line) / STITCH_PITCH_MM), 0);
  const kept = stitchRuns(outline, holes).reduce((sum, run) => sum + run.points.length, 0);
  return planned ? kept / planned : 0;
}

function bandWidth(outline: Vec[], holes: Vec[][]) {
  return Math.min(Infinity, ...holes.flatMap((hole) => hole.map((point) => distanceToLine(point, outline, true))));
}

function overhang(piece: BespokePiece, body: BespokePiece) {
  const line = outlineOf(body);
  return outlineOf(piece).reduce((most, point) => (contains(line, point) ? most : Math.max(most, distanceToLine(point, line, true))), 0);
}

function pieceFindings(piece: BespokePiece, design: BespokeDesign, body: BespokePiece | null, litres: number) {
  const found: Finding[] = [];
  const add = (id: string, level: Finding["level"], title: string, fix: string) => found.push({ id: `${id}-${piece.id}`, level, pieceId: piece.id, title, fix });
  const outline = outlineOf(piece);
  if (piece.kind === "panel" && !piece.closed) {
    add("open", "blocker", `${piece.name} is not closed`, "Click its first point to close the outline, or delete it.");
    return found;
  }
  if (piece.kind === "tube") {
    const needed = Math.max(RULES.minHandleWidthMm, litres * RULES.handleWidthPerLitre);
    if (piece.tubeStyle !== "chain" && piece.tubeWidth < needed) add("narrow", "warning", `${piece.name} is narrow for this bag`, `Widen it to about ${Math.ceil(needed)} mm, or make the bag smaller.`);
    const length = pathLength(outline);
    const bag = body ? boundsOf(outlineOf(body)) : null;
    const span = bag ? (bag.width + bag.height) / 1000 : 0;
    const carriesLoad = (RULES.bagTypesWithStraps as readonly string[]).includes(design.productType) && piece.tubeStyle !== "chain";
    if (carriesLoad && length > RULES.strapMinLengthMm && piece.tubeWidth < span * RULES.strapWidthPerBagMetre) add("strap", "warning", `${piece.name} may cut in on a bag this size`, `Widen the strap to about ${Math.ceil(span * RULES.strapWidthPerBagMetre)} mm.`);
    found.push(...hardwareFindings(piece, []));
    return found;
  }
  if (crossesItself(outline)) add("cross", "blocker", `The outline of ${piece.name} crosses itself`, "Move a point so the outline opens out.");
  const box = boundsOf(outline);
  if (piece.holeOf) {
    const parent = design.pieces.find((item) => item.id === piece.holeOf);
    if (parent && !outline.every((point) => contains(outlineOf(parent), point))) add("hole", "blocker", `The cut-out ${piece.name} must sit fully inside ${parent.name}`, "Drag or shrink it until the whole shape is on the leather.");
    return found;
  }
  const holes = holeOutlines(piece, design.pieces);
  const width = Math.min(narrowestWidth(outline), bandWidth(outline, holes));
  if (width < RULES.minPieceWidthMm) {
    add("thin", width < RULES.tooNarrowToCutMm ? "blocker" : "warning", `${piece.name} is very thin, about ${Math.round(width)} mm at its narrowest`, `Keep it at least ${RULES.minPieceWidthMm} mm wide so it can be cut and edged.`);
  }
  if (netArea(piece, design.pieces) / 10_000 > RULES.maxPieceAreaDm2) add("hide", "blocker", `${piece.name} is larger than one hide`, `Keep a piece under ${RULES.maxPieceAreaDm2} dm², or split it in two.`);
  const corner = sharpestCorner(outline);
  if (piece.stitched && corner < RULES.minCornerDegrees) add("corner", "warning", `${piece.name} has a corner too tight to stitch`, "Add a point or use a curve to open the corner.");
  const radius = piece.stitched ? tightestCurveRadius(piece) : Infinity;
  if (radius < RULES.minCornerRadiusMm) {
    add("radius", radius < RULES.tooTightCornerRadiusMm ? "blocker" : "warning", `${piece.name} has a curve of about ${radius.toFixed(1)} mm radius, too tight to stitch`, `Open the curve to at least ${RULES.minCornerRadiusMm} mm radius, or make it a clean corner.`);
  }
  if (piece.stitched) {
    if (width < RULES.stitchedMinPieceMm) add("stitch", "warning", `The stitch line runs off ${piece.name}`, "Widen the piece, or turn stitching off.");
    else if (stitchCoverage(outline, holes) < RULES.minStitchCoverage) add("stitch", "warning", `The stitch line breaks on ${piece.name}`, "Open out the narrow part so the stitch can follow the edge.");
  }
  if (piece === body && Math.max(box.width, box.height) > RULES.unsupportedSpanMm && design.depth > 0 && !design.pieces.some((item) => item.name.toLowerCase().includes("base") || item.view === "base")) add("span", "warning", `${piece.name} has a long unsupported span`, "Add a base panel or a stiffened strap.");
  if (body && piece !== body && piece.view === "front" && overhang(piece, body) > RULES.unsupportedOverhangMm) add("overhang", "warning", `${piece.name} hangs a long way past the body with nothing behind it`, "Shorten it, or add a piece behind it for support.");
  found.push(...hardwareFindings(piece, holes));
  if (piece.logo) {
    if (!piece.logo.rightsConfirmed) add("rights", "blocker", `Confirm you may use the logo on ${piece.name}`, `Tick the box under the logo. Style: ${LOGO_STYLES[piece.logo.style]}.`);
    if (!contains(outline, piece.logo)) add("logo", "warning", `The logo sits off ${piece.name}`, "Drag it back onto the piece.");
  }
  return found;
}

function looseFindings(design: BespokeDesign, body: BespokePiece) {
  const front = design.pieces.filter((piece) => piece !== body && (isSolidPanel(piece) || piece.kind === "tube") && piece.view === "front");
  const joined = [shapeOf(body)];
  let waiting = front;
  for (let moved = true; moved && waiting.length; ) {
    moved = false;
    const still: BespokePiece[] = [];
    for (const piece of waiting) {
      const shape = shapeOf(piece);
      if (joined.some((other) => shapeGap(shape, other) <= RULES.touchToleranceMm)) {
        joined.push(shape);
        moved = true;
      } else still.push(piece);
    }
    waiting = still;
  }
  return waiting.map((piece): Finding => {
    const shape = shapeOf(piece);
    const away = Math.min(...joined.map((other) => shapeGap(shape, other)));
    return { id: `loose-${piece.id}`, level: away > RULES.looseGapBlockerMm ? "blocker" : "warning", pieceId: piece.id, title: `${piece.name} does not touch the body, about ${Math.round(away)} mm away`, fix: "Move it so it overlaps the body or a piece joined to it, or hide it." };
  });
}

export function checkDesign(source: BespokeDesign): Finding[] {
  const design = visibleDesign(source);
  const body = bodyOf(design);
  const findings: Finding[] = [];
  const box = body ? boundsOf(outlineOf(body)) : null;
  const litres = box ? (box.width * box.height * Math.max(design.depth, 20)) / 1_000_000 : 0;
  for (const piece of design.pieces) findings.push(...pieceFindings(piece, design, body, litres));
  if (body) findings.push(...looseFindings(design, body));
  const measured = measureDesign(design);
  if (measured) {
    const hide = measured.measures.areaDm2 * HIDE_WASTAGE;
    const pieceId = body?.id ?? measured.closed[0]!.id;
    if (hide > RULES.maxHideAreaDm2) findings.push({ id: "area", level: "blocker", pieceId, title: `This design needs more than one full hide, about ${Math.round(hide)} dm² with wastage`, fix: "Reduce the size or remove some pieces." });
    else if (hide > RULES.warnHideAreaDm2) findings.push({ id: "area", level: "warning", pieceId, title: `This design uses a lot of hide, about ${Math.round(hide)} dm² with wastage`, fix: "Check the size of the largest pieces, or expect a higher price." });
  }
  return findings.sort((a, b) => (a.level === b.level ? 0 : a.level === "blocker" ? -1 : 1));
}

