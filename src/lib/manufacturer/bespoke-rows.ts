import { HARDWARE, LOGO_STYLES, PRODUCT_TYPES, TEXT_FONTS, TEXT_TECHNIQUES, VIEWS, type BespokeDesign, type BespokePiece } from "../bespoke/design";
import { hardwareList, measureDesign } from "../bespoke/estimate";
import { boundsOf, netArea, outlineOf, pathLength, textPlacement } from "../bespoke/outline";
import { COLORS, FINISHES, METALS, THREADS } from "../studio/spec";
import { exactRow, length, millimetres, number, row, swatchRow, withEverythingShown, type SheetRow, type SheetSection } from "./rows";
import type { BespokeSnapshot } from "./snapshot";

const yesNo = (value: boolean) => (value ? "Yes" : "No");
const colorValue = (key: BespokePiece["color"]) => `${COLORS[key].name} (code ${key}, ${COLORS[key].hex})`;
const TEXT_PLACES: Record<BespokePiece["textPlace"], string> = { center: "Centre of the piece", top: "Near the top", bottom: "Near the bottom", corner: "Lower right corner" };
const TUBE_STYLES: Record<BespokePiece["tubeStyle"], string> = { rolled: "Rolled leather", flat: "Flat leather", bar: "Rigid bar", chain: "Chain" };

function hardwareRows(piece: BespokePiece, path: string, metal: string): SheetRow[] {
  return piece.hardware.map((item, index) => {
    const at = `${path}.hardware.${index}`;
    const stretch = item.kind === "zip" ? `, ${length(item.length)} long` : `, length not used (stored ${millimetres(item.length)})`;
    return row(
      `Fitting ${index + 1}, ${HARDWARE[item.kind].name}`,
      `${item.label ? `${item.label}, ` : ""}${metal}${stretch}, shape ${item.shape}, at x ${millimetres(item.x)}, y ${millimetres(item.y)} from the piece origin, turned ${number(item.rotation, 1)} degrees`,
      at,
    );
  });
}

function pieceSize(piece: BespokePiece, design: BespokeDesign) {
  const outline = outlineOf(piece);
  if (piece.kind === "tube") return `${length(pathLength(outline))} long, ${length(piece.tubeWidth)} wide`;
  const box = boundsOf(outline);
  return `${length(box.width)} wide, ${length(box.height)} high, ${number(netArea(piece, design.pieces) / 10_000, 2)} dm² of leather`;
}

function pieceSection(piece: BespokePiece, index: number, design: BespokeDesign): SheetSection {
  const path = `pieces.${index}`;
  const metal = METALS[design.metal].name;
  const cut = piece.holeOf ? design.pieces.find((other) => other.id === piece.holeOf)?.name ?? piece.holeOf : null;
  const rows: SheetRow[] = [
    exactRow("Piece name", piece.name, `${path}.name`),
    row("Type", piece.kind === "tube" ? "Handle or strap" : cut ? `Cut-out through ${cut}` : "Leather panel", `${path}.kind`, `${path}.holeOf`),
    row("Face of the piece", VIEWS[piece.view], `${path}.view`),
    row("Size", pieceSize(piece, design), `${path}.points`),
    row("Outline", `${piece.points.length} points, ${piece.closed ? "closed shape" : "open path"}. Exact curve in the cut sheet and pattern.`, `${path}.closed`),
    row("Mirrored", piece.mirror ? `Yes, about x ${millimetres(piece.axisX)}` : `No (axis x ${millimetres(piece.axisX)})`, `${path}.mirror`, `${path}.axisX`),
    row("Leather", `${FINISHES[piece.finish].name} (code ${piece.finish})`, `${path}.finish`),
    swatchRow("Colour", colorValue(piece.color), COLORS[piece.color].hex, `${path}.color`),
    ...(THREADS[piece.thread].hex ? [swatchRow("Thread", `${THREADS[piece.thread].name} (code ${piece.thread})`, THREADS[piece.thread].hex, `${path}.thread`)] : [row("Thread", `${THREADS[piece.thread].name} (code ${piece.thread})`, `${path}.thread`)]),
    row("Stitched", piece.stitched ? "Yes, hand stitched" : "No", `${path}.stitched`),
    row("Layer order", `${piece.stack}, higher sits on top`, `${path}.stack`),
    row("Padding", piece.puff ? length(piece.puff) : "None", `${path}.puff`),
    row("Fold line", piece.fold ? `From ${millimetres(piece.fold.ax)}, ${millimetres(piece.fold.ay)} to ${millimetres(piece.fold.bx)}, ${millimetres(piece.fold.by)}, folded ${number(piece.fold.angle, 1)} degrees` : "None", `${path}.fold`),
    row("Shown on the design", yesNo(piece.visible), `${path}.visible`),
    row("Piece code", piece.id, `${path}.id`),
  ];
  rows.push(
    row("Handle width", piece.kind === "tube" ? length(piece.tubeWidth) : `Not used (stored ${length(piece.tubeWidth)})`, `${path}.tubeWidth`),
    row("Handle style", piece.kind === "tube" ? TUBE_STYLES[piece.tubeStyle] : `Not used (stored ${TUBE_STYLES[piece.tubeStyle]})`, `${path}.tubeStyle`),
    row("End rings", piece.kind === "tube" ? (piece.rings ? `2 rings, ${metal}` : "None") : `Not used (stored ${yesNo(piece.rings)})`, `${path}.rings`),
  );
  rows.push(...hardwareRows(piece, path, metal));
  if (!piece.hardware.length) rows.push(row("Fittings on this piece", "None", `${path}.hardware`));
  if (piece.text) {
    const place = textPlacement(piece);
    rows.push(
      exactRow("Text, exact wording", piece.text.value, `${path}.text.value`),
      row("Text font", TEXT_FONTS[piece.text.font], `${path}.text.font`),
      row("Text technique", TEXT_TECHNIQUES[piece.text.technique], `${path}.text.technique`),
      row("Text size", `${length(place.size)} font size`),
      row("Text position", `${TEXT_PLACES[piece.textPlace]}, at x ${millimetres(place.x)}, y ${millimetres(place.y)}`, `${path}.textPlace`),
    );
  } else {
    rows.push(row("Text", "None", `${path}.text`), row("Text position", `Not used (stored ${TEXT_PLACES[piece.textPlace]})`, `${path}.textPlace`));
  }
  if (piece.logo) {
    rows.push(
      row("Logo style", LOGO_STYLES[piece.logo.style], `${path}.logo.style`),
      row("Logo width", length(piece.logo.width), `${path}.logo.width`),
      row("Logo rotation", `${number(piece.logo.rotation, 1)} degrees`, `${path}.logo.rotation`),
      row("Logo position", `x ${millimetres(piece.logo.x)}, y ${millimetres(piece.logo.y)} from the piece origin`, `${path}.logo.x`, `${path}.logo.y`),
      row("Logo rights", piece.logo.rightsConfirmed ? "Customer confirmed they may use it" : "Not confirmed. Ask OCCUIN before applying.", `${path}.logo.rightsConfirmed`),
      row("Logo file", `Shown below, file code ${piece.logo.id}`, `${path}.logo.id`),
    );
  } else {
    rows.push(row("Logo", "None", `${path}.logo`));
  }
  return { title: `Piece ${index + 1}: ${piece.name}`, rows };
}

export function bespokeSections(snapshot: BespokeSnapshot): SheetSection[] {
  const { design } = snapshot;
  const measured = measureDesign(design)?.measures ?? null;
  const fittings = hardwareList(design);
  const body = design.pieces.find((piece) => piece.id === design.bodyId);
  const overview: SheetRow[] = [
    exactRow("Design name", design.name || "Not named", "name"),
    row("Bespoke reference", snapshot.reference),
    row("Product type", PRODUCT_TYPES[design.productType], "productType"),
    row("Specification version", String(design.version), "version"),
    exactRow("Closure, as the customer wrote it", design.closure || "Not stated", "closure"),
    exactRow("Design notes from the customer", design.notes || "None", "notes"),
    exactRow("Request notes from the customer", snapshot.notes || "None"),
  ];
  const dimensions: SheetRow[] = measured
    ? [
        row("Width", length(measured.widthMm)),
        row("Height", length(measured.heightMm)),
        row("Depth", design.depth ? length(design.depth) : "Flat, no depth", "depth"),
        row("Leather area, all pieces", `${number(measured.areaDm2, 1)} dm²`),
        row("Stitched length", length(measured.stitchedMm)),
        row("Number of pieces", String(measured.pieceCount)),
      ]
    : [row("Depth", design.depth ? length(design.depth) : "Flat, no depth", "depth")];
  const hardware: SheetRow[] = [
    swatchRow("Hardware metal", `${METALS[design.metal].name} (code ${design.metal})`, METALS[design.metal].hex, "metal"),
    ...fittings.map((item) => row(`Fitting total, ${item.name}`, `${item.quantity}, ${METALS[design.metal].name}`)),
  ];
  return withEverythingShown(design, [
    { title: "Design", rows: overview },
    { title: "Outer dimensions", rows: dimensions },
    { title: "Build", rows: [row("Main body panel", body?.name ?? "None chosen", "bodyId"), swatchRow("Lining", `${FINISHES.suede.name}, ${colorValue(design.lining)}`, COLORS[design.lining].hex, "lining")] },
    { title: "Hardware", rows: hardware },
    ...design.pieces.map((piece, index) => pieceSection(piece, index, design)),
  ]);
}
