import { COLORS, FINISHES, METALS, PATTERNS, THREADS, type ColorKey, type DesignSpec, type Hide } from "../studio/spec";
import { exactRow, length, millimetres, number, percent, row, signedLength, swatchRow, withEverythingShown, type SheetRow, type SheetSection } from "./rows";

const LAYOUT_NAMES: Record<DesignSpec["panels"]["layout"], string> = {
  single: "Single, one hide across the whole face",
  yoke: "Yoke, accent hide across the top",
  split: "Split, two hides side by side",
  diagonal: "Diagonal, two hides meeting on a slant",
  tipped: "Tipped, accent hide on the corners",
};
const CLOSURE_NAMES: Record<DesignSpec["closure"]["type"], string> = { open: "Open top", zip: "Zip across the top", flap: "Flap" };
const FLAP_NAMES: Record<DesignSpec["closure"]["flapShape"], string> = { straight: "Straight", round: "Round", point: "Point" };
const CLASP_NAMES: Record<DesignSpec["closure"]["clasp"], string> = { none: "No clasp", turnlock: "Turnlock", bar: "Bar" };
const POCKET_NAMES: Record<DesignSpec["pocket"], string> = { none: "No pocket", slip: "Slip pocket", zip: "Zip pocket" };
const FONT_NAMES: Record<DesignSpec["monogram"]["font"], string> = { didone: "Didone, Bodoni Moda", grotesk: "Grotesk, Geist", script: "Script, Pinyon Script" };
const TECHNIQUE_NAMES: Record<DesignSpec["monogram"]["technique"], string> = { blind: "Blind deboss", gold: "Gold foil", palladium: "Palladium foil", paint: "Hand painted" };
const GUSSET_NAMES: Record<DesignSpec["form"]["gusset"], string> = { flat: "Flat", bellows: "Bellows, folds inward" };

const coded = (name: string, code: string) => `${name} (code ${code})`;
const colorValue = (key: ColorKey) => `${COLORS[key].name} (code ${key}, ${COLORS[key].hex})`;
const leatherRows = (label: string, hide: Hide, path: string): SheetRow[] => [
  row(`${label} leather`, coded(FINISHES[hide.finish].name, hide.finish), `${path}.finish`),
  swatchRow(`${label} colour`, colorValue(hide.color), COLORS[hide.color].hex, `${path}.color`),
];

function monogramRows(spec: DesignSpec): SheetRow[] {
  const { monogram, closure, form, surface } = spec;
  const wording = monogram.text.trim().toUpperCase();
  const allOver = surface.pattern === "signature";
  const shown = wording || (allOver ? "OC" : "");
  const flap = monogram.placement === "flap" && closure.type === "flap";
  const fontSize = Math.max(Math.min(form.height * 0.13, flap ? 36 : 40), 9);
  const position = allOver
    ? "All over the panels, as the surface pattern"
    : flap
      ? `On the flap, centred, ${length(form.height * closure.flapLength * 0.46)} down from the fold`
      : monogram.placement === "corner"
        ? `Front panel, lower right, ${length(form.width * 0.33)} right of centre, ${length(Math.max(form.height * 0.14, fontSize * 0.9))} up from the base`
        : `Front panel, centred, ${length(form.height * 0.5)} up from the base`;
  if (!shown) {
    return [
      exactRow("Wording", "None", "monogram.text"),
      row("Font", `Not used (stored ${FONT_NAMES[monogram.font]})`, "monogram.font"),
      row("Technique", `Not used (stored ${TECHNIQUE_NAMES[monogram.technique]})`, "monogram.technique"),
      row("Position", `Not used (stored ${monogram.placement})`, "monogram.placement"),
    ];
  }
  return [
    exactRow("Wording, exactly as made", `${shown}${monogram.text.trim() && monogram.text !== wording ? ` (typed by the customer as "${monogram.text}")` : ""}${!monogram.text.trim() ? " (house initials, the customer typed none)" : ""}`, "monogram.text"),
    row("Font", FONT_NAMES[monogram.font], "monogram.font"),
    row("Technique", TECHNIQUE_NAMES[monogram.technique], "monogram.technique"),
    row("Letter size", allOver ? "Follows the pattern scale" : `${length(fontSize)} font size`),
    row("Position", position, "monogram.placement"),
  ];
}

function fittingRows(spec: DesignSpec): SheetRow[] {
  const { form, carry, closure, hardware, pocket } = spec;
  const metal = METALS[hardware.metal].name;
  const halfTop = (form.width / 2) * form.taper;
  const spread = Math.min(halfTop * 0.46, Math.max(carry.handleDrop * 0.75, 40));
  const rows: SheetRow[] = [];
  const add = (label: string, value: string) => rows.push(row(label, `${value}. ${metal}.`, "hardware.metal"));
  if (carry.handles === 2) {
    const tab = Math.min(Math.max(form.height * 0.26, 34), 86);
    add("Handle rivets", `8, two on each handle tab, four tabs at ${length(spread)} either side of centre, front and back, tabs ${length(tab)} long`);
  }
  if (carry.handles === 1 && closure.type === "open") add("Handle D-rings", `2, ${millimetres(carry.handleWidth + 8)} wide, on side tabs ${length(28)} below the top edge`);
  if (carry.handles === 1 && closure.type !== "open") {
    add("Handle D-rings", `2, ${millimetres(carry.handleWidth + 6)} wide, on the top edge at ${length(spread)} either side of centre`);
    add("Handle rivets", "4, two through each top saddle tab");
  }
  if (carry.strap) {
    add("Strap D-rings", `2, ${millimetres(carry.strapWidth + 6)} wide, on the side tabs ${length(form.height * 0.82)} up from the base`);
    add("Strap buckle", `1, ${millimetres(carry.strapWidth + 6)} wide, on the strap one fifth of the way along, with a leather keeper`);
  }
  if (closure.type === "zip") add("Top zip fittings", "1 slider and pull at the right hand end, metal teeth along the whole top edge, black zip tape");
  if (pocket === "zip" && form.height > 100) add("Pocket zip fittings", "1 slider and pull at the right hand end of the pocket zip, metal teeth, black zip tape");
  if (closure.type === "flap" && closure.clasp === "turnlock") add("Flap clasp", `1 turnlock with 4 small rivets, centred on the flap, ${length(Math.max(form.height * closure.flapLength * 0.13, 12))} up from the flap tip`);
  if (closure.type === "flap" && closure.clasp === "bar") add("Flap clasp", `1 bar, ${length(Math.min(form.width * 0.3, 70))} wide, with 2 rivets, centred on the flap, ${length(Math.max(form.height * closure.flapLength * 0.13, 12))} up from the flap tip`);
  if (hardware.feet && form.depth >= 40) add("Base feet", `4, at ${length((form.width / 2) * 0.76)} either side of centre and ${length(form.depth * 0.34)} front and back of centre`);
  return rows;
}

function zipRows(spec: DesignSpec): SheetRow[] {
  const zips: string[] = [];
  if (spec.closure.type === "zip") zips.push(`Top closure zip, ${length(spec.form.width * spec.form.taper)} long`);
  if (spec.pocket === "zip") zips.push(`Front pocket zip, ${length(spec.form.width * 0.66)} long`);
  return [row("Zips", zips.join("; ") || "None", "closure.type", "pocket")];
}

export function studioSections(spec: DesignSpec): SheetSection[] {
  const { form, panels, surface, closure, carry, hardware, stitch, pocket } = spec;
  const divideSpan = panels.layout === "split" ? form.width : form.height;
  const flap = closure.type === "flap";
  const usesAccent = panels.layout !== "single";
  const thread = THREADS[stitch.thread];
  const stitchesPerInch = 25.4 / stitch.length;
  const pocketFits = pocket !== "none" && form.height > 100;
  const sections: SheetSection[] = [
    { title: "Design", rows: [exactRow("Design name", spec.name, "name"), row("Specification version", String(spec.version), "version")] },
    {
      title: "Outer dimensions",
      rows: [
        row("Width at the base", length(form.width), "form.width"),
        row("Height", length(form.height), "form.height"),
        row("Depth", length(form.depth), "form.depth"),
      ],
    },
    {
      title: "Silhouette and shape",
      rows: [
        row("Top width", `${length(form.width * form.taper)}, ${number(form.taper, 2)} of the base width`, "form.taper"),
        row("Belly", `${signedLength(form.belly * 0.14 * form.width)} at each side at mid height, setting ${number(form.belly, 2)}`, "form.belly"),
        row("Top arc", `${signedLength(form.topArc * 0.32 * form.height)} at the centre of the top edge, setting ${number(form.topArc, 2)}`, "form.topArc"),
        row("Bottom corner radius", length(form.cornerBottom), "form.cornerBottom"),
        row("Top corner radius", length(form.cornerTop), "form.cornerTop"),
        row("Softness", `${percent(form.softness)}, 0% is rigid, 100% is fully slouched`, "form.softness"),
      ],
    },
    {
      title: "Panels and leather",
      rows: [
        row("Panel layout", LAYOUT_NAMES[panels.layout], "panels.layout"),
        row("Panel join", usesAccent && panels.layout !== "tipped" && panels.layout !== "diagonal" ? `${length(divideSpan * panels.divide)} (${percent(panels.divide)} of the ${panels.layout === "split" ? "width" : "height"})` : `Not used (stored ${percent(panels.divide)})`, "panels.divide"),
        ...leatherRows("Main panel", panels.primary, "panels.primary"),
        ...(usesAccent
          ? leatherRows("Accent panel", panels.accent, "panels.accent")
          : [
              row("Accent panel leather", `Not used (stored ${FINISHES[panels.accent.finish].name})`, "panels.accent.finish"),
              row("Accent panel colour", `Not used (stored ${COLORS[panels.accent.color].name})`, "panels.accent.color"),
            ]),
      ],
    },
    {
      title: "Surface",
      rows: [
        row("Surface pattern", coded(PATTERNS[surface.pattern].name, surface.pattern), "surface.pattern"),
        row("Pattern scale", surface.pattern === "none" ? `Not used (stored ${percent(surface.scale)})` : percent(surface.scale), "surface.scale"),
      ],
    },
    {
      title: "Gusset",
      rows: [
        row("Side construction", `${GUSSET_NAMES[form.gusset]}${form.gusset === "bellows" ? `, fold ${length(Math.min(form.depth * 0.27, 52))} deep` : ""}`, "form.gusset"),
        ...leatherRows("Gusset", panels.gusset, "panels.gusset"),
      ],
    },
    {
      title: "Closure",
      rows: [
        row("Closure", CLOSURE_NAMES[closure.type], "closure.type"),
        row("Flap shape", flap ? FLAP_NAMES[closure.flapShape] : `Not used (stored ${FLAP_NAMES[closure.flapShape]})`, "closure.flapShape"),
        row("Flap length", flap ? `${length(form.height * closure.flapLength)} (${percent(closure.flapLength)} of the height)` : `Not used (stored ${percent(closure.flapLength)})`, "closure.flapLength"),
        row("Clasp", flap ? CLASP_NAMES[closure.clasp] : `Not used (stored ${CLASP_NAMES[closure.clasp]})`, "closure.clasp"),
      ],
    },
    {
      title: "Handles and strap",
      rows: [
        row("Handles", carry.handles ? `${carry.handles} ${carry.handles === 1 ? "top handle" : "top handles"}, same leather as the main panel` : "None", "carry.handles"),
        row("Handle drop", carry.handles ? length(carry.handleDrop) : `Not used (stored ${length(carry.handleDrop)})`, "carry.handleDrop"),
        row("Handle width", carry.handles ? length(carry.handleWidth) : `Not used (stored ${length(carry.handleWidth)})`, "carry.handleWidth"),
        row("Shoulder strap", carry.strap ? "Yes, same leather as the main panel" : "None", "carry.strap"),
        row("Strap length", carry.strap ? length(carry.strapLength) : `Not used (stored ${length(carry.strapLength)})`, "carry.strapLength"),
        row("Strap width", carry.strap ? length(carry.strapWidth) : `Not used (stored ${length(carry.strapWidth)})`, "carry.strapWidth"),
      ],
    },
    {
      title: "Pockets and zips",
      rows: [
        row("Front pocket", pocket === "none" ? "None" : pocketFits ? `${POCKET_NAMES[pocket]}, ${length(form.width * 0.66)} wide, mouth ${length(form.height * 0.52)} up from the base, bottom ${length(form.height * 0.16)} up from the base` : `${POCKET_NAMES[pocket]} chosen, but this height is 100 mm or less. Confirm with OCCUIN before cutting.`, "pocket"),
        ...zipRows(spec),
      ],
    },
    {
      title: "Hardware",
      rows: [
        swatchRow("Hardware metal", coded(METALS[hardware.metal].name, hardware.metal), METALS[hardware.metal].hex, "hardware.metal"),
        row("Base feet", hardware.feet ? (form.depth >= 40 ? "Yes" : "Chosen, but the depth is under 40 mm. Confirm with OCCUIN before fitting.") : "None", "hardware.feet"),
        ...fittingRows(spec),
      ],
    },
    {
      title: "Stitching and edges",
      rows: [
        ...(thread.hex
          ? [swatchRow("Thread colour", coded(thread.name, stitch.thread), thread.hex, "stitch.thread")]
          : [row("Thread colour", `${coded(thread.name, stitch.thread)}, a lighter shade of the main panel colour`, "stitch.thread")]),
        row("Stitch type", "Hand stitched"),
        row("Stitch length", `${millimetres(stitch.length)}, ${number(stitchesPerInch, 1)} stitches per inch`, "stitch.length"),
        row("Stitch rows", stitch.rows === 2 ? "2, double row" : "1, single row", "stitch.rows"),
        swatchRow("Edge finish", `Hand painted edge, ${colorValue(spec.edgeColor)}`, COLORS[spec.edgeColor].hex, "edgeColor"),
      ],
    },
    { title: "Lining", rows: [swatchRow("Lining", `${FINISHES.suede.name}, ${colorValue(spec.liningColor)}`, COLORS[spec.liningColor].hex, "liningColor")] },
    { title: "Monogram and logo", rows: [...monogramRows(spec), row("Logo", "None. The studio does not offer a logo on this piece.")] },
  ];
  return withEverythingShown(spec, sections);
}
