import { HARDWARE, VIEWS, type BespokeDesign, type BespokePiece, type DesignView } from "@/lib/bespoke/design";
import { visibleDesign } from "@/lib/bespoke/estimate";
import { bodyOf, compoundPath, groupBounds, holeOutlines, isSolidPanel, layerOrder, offsetPath, outlineOf, piecePath, stitchRuns, textPlacement } from "@/lib/bespoke/outline";
import { COLORS, METALS, THREADS } from "@/lib/studio/spec";

const MARGIN_MM = 30;
const GRID_MM = 10;
const FOIL = "#e2b963";

export const threadHex = (piece: Pick<BespokePiece, "thread" | "color">) => THREADS[piece.thread].hex || "#d9cdb8";

const runPath = (points: { x: number; y: number }[], ring: boolean) =>
  `M${points.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}${ring ? "Z" : ""}`;

export function HardwareGlyph({ item, metal, selected = false }: { item: BespokePiece["hardware"][number]; metal: BespokeDesign["metal"]; selected?: boolean }) {
  const color = METALS[metal].hex;
  const line = { fill: "none", stroke: color, strokeWidth: 3 };
  return (
    <g transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}>
      <title>{item.label || HARDWARE[item.kind].name}</title>
      {item.kind === "rivet" ? (item.shape === "square" ? <rect x="-4.5" y="-4.5" width="9" height="9" fill={color} /> : <circle r={item.shape === "long" ? 3.5 : 5} fill={color} />) : null}
      {item.kind === "turnlock" ? (
        <>
          <rect x="-17" y="-10" width="34" height="20" rx="3" fill={color} />
          <rect x="-7" y="-2" width="14" height="4" rx="2" fill="#17312a" />
        </>
      ) : null}
      {item.kind === "buckle" ? (
        <>
          <rect x="-17" y="-13" width="34" height="26" rx={item.shape === "round" ? 13 : 3} {...line} />
          <path d="M0 -13V13M0 0H19" {...line} strokeWidth="2.4" />
        </>
      ) : null}
      {item.kind === "dring" ? <path d="M-12 0A12 12 0 0 0 12 0Z" {...line} /> : null}
      {item.kind === "ring" && item.shape !== "square" ? <circle r={item.shape === "long" ? 9 : 13} {...line} /> : null}
      {item.kind === "ring" && item.shape === "square" ? <rect x="-12" y="-12" width="24" height="24" rx="2" {...line} /> : null}
      {item.kind === "foot" ? (item.shape === "square" ? <rect x="-6" y="-6" width="12" height="12" rx="2" fill={color} /> : <circle r="6.5" fill={color} />) : null}
      {item.kind === "snap" ? (
        <>
          <circle r="9" fill={color} />
          <circle r="4" fill="#17312a" fillOpacity="0.35" />
        </>
      ) : null}
      {item.kind === "stud" ? <circle r="7" fill={color} /> : null}
      {item.kind === "pull" ? (
        <>
          <circle cy="-7" r="2.6" {...line} strokeWidth="1.6" />
          {item.shape === "long" ? <rect x="-2.5" y="-5" width="5" height="26" rx="2" fill={color} /> : item.shape === "round" ? <circle cy="4" r="7" fill={color} /> : <path d="M-4 -5H4V8L0 13L-4 8Z" fill={color} />}
        </>
      ) : null}
      {item.kind === "zip" ? (
        <>
          <rect x={-item.length / 2} y="-4" width={item.length} height="8" fill="#191714" />
          <line x1={-item.length / 2} x2={item.length / 2} y1="0" y2="0" stroke={color} strokeWidth="2.4" strokeDasharray="1.4 1.4" />
          <rect x={item.length / 2 - 12} y="-3.5" width="8" height="7" fill={color} />
          <rect x={item.length / 2 - 9.5} y="3" width="3" height="11" fill={color} />
        </>
      ) : null}
      {selected ? <circle r={item.kind === "zip" ? 16 : 22} fill="none" stroke={FOIL} strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" /> : null}
    </g>
  );
}

function LogoGlyph({ logo }: { logo: NonNullable<BespokePiece["logo"]> }) {
  const half = logo.width / 2;
  return (
    <g transform={`translate(${logo.x} ${logo.y}) rotate(${logo.rotation})`} opacity={logo.style === "deboss" ? 0.5 : 1} style={logo.style === "deboss" ? { filter: "brightness(0)" } : undefined}>
      <image href={`/api/bespoke/logo/${logo.id}`} x={-half} y={-half} width={logo.width} height={logo.width} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

function TubePiece({ piece, metal, selected }: { piece: BespokePiece; metal: BespokeDesign["metal"]; selected: boolean }) {
  const outline = outlineOf(piece);
  const path = piecePath(piece);
  const ends = outline.length > 1 ? [{ at: outline[0]!, from: outline[1]! }, { at: outline[outline.length - 1]!, from: outline[outline.length - 2]! }] : [];
  const radius = piece.tubeWidth / 2 + 3;
  return (
    <g opacity={piece.visible ? 1 : 0.45} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {selected ? <path d={path} stroke={FOIL} strokeWidth={piece.tubeWidth + 2.5} /> : null}
      <path d={path} stroke={COLORS[piece.color].hex} strokeWidth={piece.tubeWidth} />
      {piece.tubeStyle === "chain" ? <path d={path} stroke={METALS[metal].hex} strokeWidth={piece.tubeWidth * 0.7} strokeDasharray="14 10" strokeLinecap="butt" /> : null}
      {piece.stitched && piece.tubeStyle !== "chain" && outline.length > 1
        ? [-1, 1].map((side) => (
            <path key={side} d={runPath(offsetPath(outline, side * (piece.tubeWidth / 2 - Math.min(3, piece.tubeWidth * 0.18))), false)} stroke={threadHex(piece)} strokeWidth="1" strokeDasharray="2.6 1.7" vectorEffect="non-scaling-stroke" />
          ))
        : null}
      {piece.rings
        ? ends.map(({ at, from }, index) => {
            const length = Math.hypot(at.x - from.x, at.y - from.y) || 1;
            return <circle key={index} cx={at.x + ((at.x - from.x) / length) * (radius - 1)} cy={at.y + ((at.y - from.y) / length) * (radius - 1)} r={radius} stroke={METALS[metal].hex} strokeWidth="3" />;
          })
        : null}
    </g>
  );
}

type PlanPieceProps = { piece: BespokePiece; pieces: BespokePiece[]; metal: BespokeDesign["metal"]; selected?: boolean; hardwareId?: string | null; grain?: { shade: string; light: string; gloss?: number } | null };

export function PlanPiece({ piece, pieces, metal, selected = false, hardwareId = null, grain = null }: PlanPieceProps) {
  if (piece.kind === "tube") return <TubePiece piece={piece} metal={metal} selected={selected} />;
  if (piece.holeOf) {
    return <path d={piecePath(piece)} fill="rgb(16 36 30 / 0.35)" stroke={selected ? FOIL : "#f3ecdd"} strokeWidth={selected ? 1.75 : 1.25} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" opacity={piece.visible ? 1 : 0.45} />;
  }
  const path = compoundPath(piece, pieces);
  const outer = piecePath(piece);
  const label = piece.text ? textPlacement(piece) : null;
  const holes = holeOutlines(piece, pieces);
  return (
    <g opacity={piece.visible ? 1 : 0.45}>
      <path d={path} fill={COLORS[piece.color].hex} fillRule="evenodd" />
      {grain ? <path d={path} fill={grain.shade} fillRule="evenodd" /> : null}
      {grain ? <path d={path} fill={grain.light} fillRule="evenodd" /> : null}
      {piece.puff ? <path d={path} fill="url(#plan-puff)" fillRule="evenodd" /> : null}
      {grain?.gloss ? <path d={path} fill="url(#plan-gloss)" fillRule="evenodd" opacity={grain.gloss} /> : null}
      {piece.stitched
        ? stitchRuns(outlineOf(piece), holes).map((run, index) => (
            <path key={index} d={runPath(run.points, run.ring)} fill="none" stroke={threadHex(piece)} strokeWidth="1.1" strokeDasharray="2.6 1.7" vectorEffect="non-scaling-stroke" />
          ))
        : null}
      {label ? (
        <text x={label.x} y={label.y} fontSize={label.size} textAnchor="middle" dominantBaseline="central" fontFamily={piece.text?.font === "didone" ? "var(--font-bodoni), serif" : "var(--font-geist), sans-serif"} fill={piece.text?.technique === "palladium" ? "#dcdcd8" : piece.text?.technique === "gold" ? FOIL : "rgb(0 0 0 / 0.45)"}>
          {piece.text?.value}
        </text>
      ) : null}
      <path d={path} fill="none" stroke={selected ? FOIL : "rgb(250 250 250 / 0.7)"} strokeWidth={selected ? 1.75 : 1} vectorEffect="non-scaling-stroke" />
      {piece.fold ? <line x1={piece.fold.ax} y1={piece.fold.ay} x2={piece.fold.bx} y2={piece.fold.by} stroke={FOIL} strokeWidth="1.25" strokeDasharray="8 4 2 4" vectorEffect="non-scaling-stroke" /> : null}
      {piece.logo ? <LogoGlyph logo={piece.logo} /> : null}
      {piece.hardware.map((item) => <HardwareGlyph key={item.id} item={item} metal={metal} selected={item.id === hardwareId} />)}
    </g>
  );
}

export function PlanDefs() {
  return (
    <>
      <radialGradient id="plan-puff" cx="0.42" cy="0.36" r="0.72">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
        <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.03" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.2" />
      </radialGradient>
      <linearGradient id="plan-gloss" x1="0.75" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#fff6e6" stopOpacity="0.34" />
        <stop offset="0.45" stopColor="#fff6e6" stopOpacity="0.04" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
      </linearGradient>
    </>
  );
}

export function DesignPlan({ design, view = "front", className = "" }: { design: BespokeDesign; view?: DesignView; className?: string }) {
  const shown = visibleDesign(design);
  const pieces = shown.pieces.filter((piece) => piece.view === view);
  const solid = pieces.filter((piece) => isSolidPanel(piece) || piece.kind === "tube");
  if (!solid.length) return <p className="text-sm text-muted">This design has no closed pieces.</p>;
  const box = groupBounds(solid);
  const x = box.minX - MARGIN_MM;
  const y = box.minY - MARGIN_MM;
  const width = box.width + MARGIN_MM * 2;
  const height = box.height + MARGIN_MM * 2;
  const body = bodyOf(shown);
  const grid = `plan-grid-${view}`;
  return (
    <svg role="img" aria-label={`${VIEWS[view]} pattern plan, ${Math.round(box.width)} by ${Math.round(box.height)} millimetres`} viewBox={`${x} ${y} ${width} ${height}`} className={`block w-full ${className}`}>
      <defs>
        <PlanDefs />
        <pattern id={grid} width={GRID_MM} height={GRID_MM} patternUnits="userSpaceOnUse">
          <path d={`M${GRID_MM} 0H0V${GRID_MM}`} fill="none" stroke="rgb(250 250 250 / 0.13)" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill="#203d34" />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${grid})`} />
      {layerOrder(pieces).map((piece) => (
        <PlanPiece key={piece.id} piece={piece} pieces={pieces} metal={design.metal} selected={piece === body} />
      ))}
    </svg>
  );
}

export function DesignViews({ design, className = "" }: { design: BespokeDesign; className?: string }) {
  const used = (Object.keys(VIEWS) as DesignView[]).filter((view) => view === "front" || design.pieces.some((piece) => piece.view === view && piece.visible));
  return (
    <div className="grid gap-4">
      {used.map((view) => (
        <figure key={view} className="grid gap-1">
          {used.length > 1 ? <figcaption className="text-sm text-muted">{VIEWS[view]}</figcaption> : null}
          <DesignPlan design={design} view={view} className={className} />
        </figure>
      ))}
    </div>
  );
}
