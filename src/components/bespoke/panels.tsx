"use client";

import { AlignBottom, AlignCenterHorizontal, AlignCenterVertical, AlignLeft, AlignRight, AlignTop, ArrowRight, Check, CircleNotch, DotsThreeOutline, DotsThreeOutlineVertical, DownloadSimple, ImageSquare, Trash, X, type Icon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ColorGrid, Group, LeatherSample, PRESS, SECONDARY, Segments, Slider, Tile, Tiles, Toggle } from "@/components/studio/controls";
import { deleteSavedBespoke, duplicateSavedBespoke, listSavedBespoke, saveBespoke, shareSavedBespoke, type SavedBespoke } from "@/lib/actions/bespoke";
import { HARDWARE, LIMITS, LOGO_STYLES, PIECE_NAMES, PRODUCT_TYPES, TEXT_FONTS, TEXT_TECHNIQUES, type BespokePiece, type ProductType } from "@/lib/bespoke/design";
import { estimateDesign, visibleDesign } from "@/lib/bespoke/estimate";
import { customerPdf, designSvg } from "@/lib/bespoke/export";
import { bodyOf, groupBounds, isSolidPanel, outlineOf, pathLength } from "@/lib/bespoke/outline";
import { designProblem } from "@/lib/bespoke/submission";
import { BESPOKE_NOTE, money } from "@/lib/format";
import { FINISHES, METALS, THREADS, type FinishKey } from "@/lib/studio/spec";
import { COUNTRIES } from "@/lib/validation";
import { useCreator, useSelectedPiece, type AlignEdge } from "./store";
import { AREA, FIELD, FormField, GLASS_PANEL } from "./ui";

const FINISH_KEYS = Object.keys(FINISHES) as FinishKey[];
const THREAD_KEYS = Object.keys(THREADS) as (keyof typeof THREADS)[];
const METAL_KEYS = Object.keys(METALS) as (keyof typeof METALS)[];
const TYPE_KEYS = Object.keys(PRODUCT_TYPES) as ProductType[];

export function useEstimate() {
  const design = useCreator((state) => state.design);
  return useMemo(() => estimateDesign(design), [design]);
}

function SizeFields({ pieces }: { pieces: BespokePiece[] }) {
  const setGroupSize = useCreator((state) => state.setGroupSize);
  const box = groupBounds(pieces);
  const key = `${Math.round(box.width * 10)}-${Math.round(box.height * 10)}`;
  const apply = (axis: "width" | "height", raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 1600) return;
    const current = axis === "width" ? box.width : box.height;
    if (Math.abs(value - current) < 0.05) return;
    if (axis === "width") setGroupSize(value, null);
    else setGroupSize(null, value);
  };
  return (
    <div key={key} className="grid grid-cols-2 gap-2">
      {(["width", "height"] as const).map((axis) => (
        <FormField key={axis} label={axis === "width" ? "Width, mm" : "Height, mm"}>
          <input
            type="number"
            min={1}
            max={1600}
            step={1}
            defaultValue={(axis === "width" ? box.width : box.height).toFixed(1)}
            onBlur={(event) => apply(axis, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply(axis, event.currentTarget.value);
            }}
            className={FIELD}
          />
        </FormField>
      ))}
    </div>
  );
}

const ALIGN: { edge: AlignEdge; label: string; icon: Icon }[] = [
  { edge: "left", label: "Align left", icon: AlignLeft },
  { edge: "centerX", label: "Align centres", icon: AlignCenterHorizontal },
  { edge: "right", label: "Align right", icon: AlignRight },
  { edge: "top", label: "Align top", icon: AlignTop },
  { edge: "centerY", label: "Align middles", icon: AlignCenterVertical },
  { edge: "bottom", label: "Align bottom", icon: AlignBottom },
];

function GroupPanel({ pieces }: { pieces: BespokePiece[] }) {
  const align = useCreator((state) => state.align);
  const distribute = useCreator((state) => state.distribute);
  const deleteSelection = useCreator((state) => state.deleteSelection);
  return (
    <div className="grid gap-5">
      <Group title={`${pieces.length} pieces selected`} note="Drag any of them to move them together, or use the corner handles to scale and rotate.">
        <SizeFields pieces={pieces} />
      </Group>
      <Group title="Arrange">
        <div role="group" aria-label="Align" className="grid grid-cols-6 gap-1">
          {ALIGN.map(({ edge, label, icon: AlignIcon }) => (
            <button key={edge} type="button" aria-label={label} title={label} onClick={() => align(edge)} className="grid h-11 place-items-center rounded-[12px] border border-fg/15 hover:bg-fg/10"><AlignIcon size={18} aria-hidden /></button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => distribute("x")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-fg/15 text-[13px] font-medium hover:bg-fg/10"><DotsThreeOutline size={16} aria-hidden />Space across</button>
          <button type="button" onClick={() => distribute("y")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-fg/15 text-[13px] font-medium hover:bg-fg/10"><DotsThreeOutlineVertical size={16} aria-hidden />Space down</button>
        </div>
      </Group>
      <button type="button" onClick={deleteSelection} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-fg/15 text-[13px] font-medium hover:bg-fg/10"><Trash size={16} aria-hidden />Delete these pieces</button>
    </div>
  );
}

function FormControls({ piece }: { piece: BespokePiece }) {
  const update = useCreator((state) => state.updatePiece);
  const toggleCutout = useCreator((state) => state.toggleCutout);
  const toggleFold = useCreator((state) => state.toggleFold);
  const parent = useCreator((state) => state.design.pieces.find((item) => item.id === piece.holeOf));
  if (piece.kind === "tube") {
    return (
      <Group title="Handle" note={`Length ${Math.round(pathLength(outlineOf(piece)))} mm.`}>
        <Slider label="Width" value={piece.tubeWidth} min={LIMITS.tubeWidthMm.min} max={LIMITS.tubeWidthMm.max} display={`${piece.tubeWidth} mm`} onChange={(tubeWidth) => update(piece.id, { tubeWidth }, `tube-${piece.id}`)} />
        <Segments label="Style" value={piece.tubeStyle} segments={[{ value: "rolled", label: "Rolled" }, { value: "flat", label: "Flat" }, { value: "bar", label: "Bar" }, { value: "chain", label: "Chain" }]} onChange={(tubeStyle) => update(piece.id, { tubeStyle })} />
        <Toggle label="Rings at the ends" note="Two metal rings." checked={piece.rings} onChange={(rings) => update(piece.id, { rings })} />
      </Group>
    );
  }
  return (
    <Group title="Form">
      <Toggle label="Cut-out" note={piece.holeOf ? `Cuts through ${parent?.name ?? "the piece below"}.` : "Use this shape as a hole in the piece below it."} checked={Boolean(piece.holeOf)} onChange={() => toggleCutout(piece.id)} />
      {piece.holeOf ? null : (
        <>
          <Slider label="Puff" value={piece.puff} min={0} max={LIMITS.puffMm} display={piece.puff ? `${piece.puff} mm` : "Flat"} onChange={(puff) => update(piece.id, { puff }, `puff-${piece.id}`)} />
          <Toggle label="Fold line" note="Tilt part of this piece along a line. Drag the gold ends on the board." checked={Boolean(piece.fold)} onChange={() => toggleFold(piece.id)} />
          {piece.fold ? (
            <>
              <Slider label="Fold angle" value={piece.fold.angle} min={-LIMITS.foldDegrees} max={LIMITS.foldDegrees} step={5} display={`${piece.fold.angle} degrees`} onChange={(angle) => update(piece.id, { fold: { ...piece.fold!, angle } }, `fold-${piece.id}`)} />
              <button type="button" onClick={() => update(piece.id, { fold: { ...piece.fold!, ax: piece.fold!.bx, ay: piece.fold!.by, bx: piece.fold!.ax, by: piece.fold!.ay } })} className="min-h-11 rounded-full border border-fg/15 text-[13px] font-medium hover:bg-fg/10">Fold the other side</button>
            </>
          ) : null}
        </>
      )}
    </Group>
  );
}

function LogoControls({ piece }: { piece: BespokePiece }) {
  const update = useCreator((state) => state.updatePiece);
  const placeLogo = useCreator((state) => state.placeLogo);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const logo = piece.logo;

  async function upload(file: File) {
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("logo", file);
    body.set("rights", rights ? "yes" : "no");
    try {
      const response = await fetch("/api/bespoke/logo", { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; id?: string; error?: string };
      if (result.ok && result.id) placeLogo(result.id, true);
      else setError(result.error ?? "We could not read that file.");
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (logo) {
    return (
      <Group title="Logo" note="Drag it on the board to move it.">
        <Slider label="Logo width" value={logo.width} min={10} max={300} display={`${logo.width} mm`} onChange={(width) => update(piece.id, { logo: { ...logo, width } }, `logo-w-${piece.id}`)} />
        <Slider label="Logo rotation" value={logo.rotation} min={-180} max={180} step={5} display={`${logo.rotation} degrees`} onChange={(rotation) => update(piece.id, { logo: { ...logo, rotation } }, `logo-r-${piece.id}`)} />
        <Segments label="Logo style" value={logo.style} segments={Object.entries(LOGO_STYLES).map(([value, label]) => ({ value: value as keyof typeof LOGO_STYLES, label }))} onChange={(style) => update(piece.id, { logo: { ...logo, style } })} />
        <button type="button" onClick={() => update(piece.id, { logo: null })} className="min-h-11 rounded-full border border-fg/15 text-[13px] font-medium hover:bg-fg/10">Remove logo</button>
      </Group>
    );
  }
  return (
    <Group title="Your logo" note="PNG or SVG, under 2 MB. Scripts and links in an SVG are refused.">
      <Toggle label="I own this logo or may use it" checked={rights} onChange={setRights} />
      <input
        ref={input}
        type="file"
        accept="image/png,image/svg+xml,.svg"
        aria-label="Choose a logo file"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
      <button type="button" disabled={!rights || pending} onClick={() => input.current?.click()} className="min-h-11 rounded-full border border-fg/20 text-[13px] font-medium hover:bg-fg/10 disabled:opacity-40">{pending ? "Uploading" : "Add a logo"}</button>
      {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
    </Group>
  );
}

function Fittings({ piece }: { piece: BespokePiece }) {
  const hardwareId = useCreator((state) => state.hardwareId);
  const selectHardware = useCreator((state) => state.selectHardware);
  const updateHardware = useCreator((state) => state.updateHardware);
  const removeHardware = useCreator((state) => state.removeHardware);
  if (!piece.hardware.length) return null;
  const active = piece.hardware.find((item) => item.id === hardwareId);
  return (
    <Group title="Fittings">
      <ul className="grid gap-1">
        {piece.hardware.map((item) => (
          <li key={item.id} className="flex items-center gap-1">
            <button type="button" aria-pressed={item.id === hardwareId} onClick={() => selectHardware(piece.id, item.id)} className="min-h-10 flex-1 rounded-full px-3 text-left text-[13px] font-medium hover:bg-fg/10 aria-pressed:bg-fg/10">{item.label || HARDWARE[item.kind].name}</button>
            <button type="button" aria-label={`Remove ${item.label || HARDWARE[item.kind].name}`} onClick={() => removeHardware(piece.id, item.id)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-fg/10"><Trash size={15} aria-hidden /></button>
          </li>
        ))}
      </ul>
      {active ? (
        <>
          <Slider label="Rotation" value={active.rotation} min={-180} max={180} step={5} display={`${active.rotation} degrees`} onChange={(rotation) => updateHardware(piece.id, active.id, { rotation }, `spin-${active.id}`)} />
          {active.kind === "zip" ? <Slider label="Zip length" value={active.length} min={20} max={600} step={5} display={`${active.length} mm`} onChange={(length) => updateHardware(piece.id, active.id, { length }, `zip-${active.id}`)} /> : null}
        </>
      ) : null}
    </Group>
  );
}

export function PiecePanel() {
  const piece = useSelectedPiece();
  const others = useCreator((state) => state.others);
  const pieces = useCreator((state) => state.design.pieces);
  const multi = useMemo(() => pieces.filter((item) => others.includes(item.id) || item.id === piece?.id), [pieces, others, piece]);
  const body = useCreator((state) => bodyOf(state.design));
  const update = useCreator((state) => state.updatePiece);
  const updateDesign = useCreator((state) => state.updateDesign);
  const nameList = useId();
  if (!piece) {
    return (
      <div className="grid gap-1 py-2">
        <h3 className="font-display text-[22px] leading-tight">No piece selected</h3>
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>Select a piece to choose its leather, thread and stack height.</p>
      </div>
    );
  }
  if (others.length) return <GroupPanel pieces={multi} />;
  const text = piece.text;
  return (
    <div className="grid gap-5">
      <FormField label="Piece name">
        <input
          list={nameList}
          value={piece.name}
          maxLength={LIMITS.pieceName}
          onChange={(event) => update(piece.id, { name: event.target.value }, `name-${piece.id}`)}
          onBlur={(event) => {
            if (!event.target.value.trim()) update(piece.id, { name: "Panel" });
          }}
          className={FIELD}
        />
        <datalist id={nameList}>
          {PIECE_NAMES.map((name) => <option key={name} value={name} />)}
        </datalist>
      </FormField>
      <SizeFields pieces={[piece]} />
      <FormControls piece={piece} />
      <Fittings piece={piece} />
      {piece.holeOf ? null : <Group title="Leather">
        <Tiles label="Finish" columns={3}>
          {FINISH_KEYS.map((finish) => (
            <Tile key={finish} label={FINISHES[finish].name} selected={piece.finish === finish} onSelect={() => update(piece.id, { finish })}>
              <LeatherSample finish={finish} color={piece.color} className="h-9 w-full" />
            </Tile>
          ))}
        </Tiles>
        <ColorGrid label="Colour" value={piece.color} finish={piece.finish} onChange={(color) => update(piece.id, { color })} />
      </Group>}
      {piece.holeOf ? null : <Group title="Stitching">
        <Toggle label="Stitched" checked={piece.stitched} onChange={(stitched) => update(piece.id, { stitched })} />
        {piece.stitched ? (
          <Tiles label="Thread" columns={3}>
            {THREAD_KEYS.map((thread) => (
              <Tile key={thread} label={THREADS[thread].name} selected={piece.thread === thread} onSelect={() => update(piece.id, { thread })} />
            ))}
          </Tiles>
        ) : null}
      </Group>}
      <Group title="Placement">
        <Slider
          label="Stack height"
          value={piece.stack}
          min={-LIMITS.stack}
          max={LIMITS.stack}
          display={piece.stack === 0 ? "Level" : piece.stack > 0 ? `${piece.stack} forward` : `${-piece.stack} back`}
          onChange={(stack) => update(piece.id, { stack }, `stack-${piece.id}`)}
        />
        {isSolidPanel(piece) ? (
          <Toggle
            label="This is the main body"
            note="The body gets the back panel and sides from the depth slider."
            checked={body?.id === piece.id}
            onChange={(checked) => updateDesign({ bodyId: checked ? piece.id : null })}
          />
        ) : null}
        {piece.mirror ? (
          <FormField label="Centre line position, mm" hint="Moves the line this piece mirrors about.">
            <input
              type="number"
              key={piece.axisX}
              min={-LIMITS.halfWidthMm}
              max={LIMITS.halfWidthMm}
              defaultValue={piece.axisX}
              onBlur={(event) => {
                const axisX = Number(event.target.value);
                if (!Number.isFinite(axisX) || Math.abs(axisX) > LIMITS.halfWidthMm || axisX === piece.axisX) return;
                update(piece.id, { axisX, points: piece.points.map((point) => ({ ...point, x: point.x + axisX - piece.axisX })) });
              }}
              className={FIELD}
            />
          </FormField>
        ) : null}
      </Group>
      {isSolidPanel(piece) ? <LogoControls piece={piece} /> : null}
      {piece.holeOf ? null : <Group title="Text or monogram" note="Optional, placed at the centre of the piece.">
        <FormField label="Text">
          <input
            value={text?.value ?? ""}
            maxLength={LIMITS.pieceText}
            onChange={(event) => {
              const value = event.target.value;
              update(piece.id, { text: value ? { value, technique: text?.technique ?? "gold", font: text?.font ?? "didone" } : null }, `text-${piece.id}`);
            }}
            onBlur={(event) => {
              if (text && !event.target.value.trim()) update(piece.id, { text: null });
            }}
            className={FIELD}
          />
        </FormField>
        {text ? (
          <>
            <Segments label="Finish" value={text.technique} segments={Object.entries(TEXT_TECHNIQUES).map(([value, label]) => ({ value: value as keyof typeof TEXT_TECHNIQUES, label: label.replace(" foil", "").replace(" press", "") }))} onChange={(technique) => update(piece.id, { text: { ...text, technique } })} />
            <Segments label="Position" value={piece.textPlace} segments={[{ value: "center", label: "Centre" }, { value: "top", label: "Top" }, { value: "bottom", label: "Low" }, { value: "corner", label: "Corner" }]} onChange={(textPlace) => update(piece.id, { textPlace })} />
            <Segments label="Letter style" value={text.font} segments={Object.entries(TEXT_FONTS).map(([value, label]) => ({ value: value as keyof typeof TEXT_FONTS, label }))} onChange={(font) => update(piece.id, { text: { ...text, font } })} />
          </>
        ) : null}
      </Group>}
    </div>
  );
}

function ReferenceImages() {
  const images = useCreator((state) => state.images);
  const addImages = useCreator((state) => state.addImages);
  const removeImage = useCreator((state) => state.removeImage);
  const notice = useCreator((state) => state.notice);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Group title="Reference images" note={`Sketches or inspiration. Up to ${LIMITS.images} images, JPG, PNG or WebP, under 3.5 MB in total. These are not kept in your draft.`}>
      {images.length ? (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((image) => (
            <li key={image.id} className="relative aspect-square overflow-hidden rounded-[14px] bg-fg/10">
              <Image unoptimized fill sizes="88px" src={image.url} alt={image.file.name} className="object-cover" />
              <button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeImage(image.id)} className="absolute right-0.5 top-0.5 grid h-7 w-7 place-items-center rounded-full bg-bg text-fg shadow-[0_1px_4px_rgb(0_0_0/0.35)]">
                <X size={12} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Add reference images"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          addImages([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <button type="button" disabled={images.length >= LIMITS.images} onClick={() => input.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-fg/20 px-4 text-[13px] font-medium transition-colors duration-200 hover:bg-fg/10 disabled:opacity-40">
        <ImageSquare size={18} aria-hidden />
        Add images
      </button>
      {notice && /image/i.test(notice) ? <p role="alert" className="text-[13px] text-danger">{notice}</p> : null}
    </Group>
  );
}

export function DetailsPanel() {
  const design = useCreator((state) => state.design);
  const update = useCreator((state) => state.updateDesign);
  return (
    <div className="grid gap-5">
      <Group title="What are you making?">
        <Tiles label="Product type" columns={3}>
          {TYPE_KEYS.map((type) => (
            <Tile key={type} label={PRODUCT_TYPES[type]} selected={design.productType === type} onSelect={() => update({ productType: type })} />
          ))}
        </Tiles>
      </Group>
      <FormField label="Design name" hint="Optional.">
        <input value={design.name} maxLength={60} onChange={(event) => update({ name: event.target.value }, "name")} className={FIELD} />
      </FormField>
      <Group title="Hardware">
        <Tiles label="Hardware metal" columns={3}>
          {METAL_KEYS.map((metal) => (
            <Tile key={metal} label={METALS[metal].name} selected={design.metal === metal} onSelect={() => update({ metal })}>
              <span aria-hidden className="block h-6 w-full rounded-[8px]" style={{ background: METALS[metal].hex }} />
            </Tile>
          ))}
        </Tiles>
      </Group>
      <FormField label="Closure notes" hint="A zip, a turn lock, a magnet, or nothing at all.">
        <input value={design.closure} maxLength={LIMITS.closure} onChange={(event) => update({ closure: event.target.value }, "closure")} className={FIELD} />
      </FormField>
      <ColorGrid label="Lining colour" value={design.lining} finish="suede" onChange={(lining) => update({ lining })} />
      <FormField label="Notes for the workshop">
        <textarea value={design.notes} maxLength={LIMITS.notes} rows={4} onChange={(event) => update({ notes: event.target.value }, "notes")} className={AREA} />
      </FormField>
      <ReferenceImages />
    </div>
  );
}

export function EstimateBar() {
  const estimate = useEstimate();
  const hidden = useCreator((state) => state.design.pieces.filter((piece) => !piece.visible).length);
  if (!estimate) {
    return (
      <div>
        <p className="font-display text-[22px] leading-tight">No estimate yet</p>
        <p className={`text-[12px] leading-snug ${SECONDARY}`}>Close a piece to see an estimate from its real size.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-display text-[24px] leading-tight tabular-nums" data-testid="estimate">Estimated {money(estimate.lowCents)} to {money(estimate.highCents)}</p>
      <p className={`text-[12px] leading-snug tabular-nums ${SECONDARY}`}>
        <span data-testid="size">{estimate.widthMm} × {estimate.heightMm} × {estimate.depthMm} mm</span>, {estimate.areaDm2.toFixed(1)} dm² of leather.{hidden ? ` ${hidden} hidden ${hidden === 1 ? "piece is" : "pieces are"} not counted.` : ""} An estimate only. Our workshop confirms the final price.
      </p>
    </div>
  );
}

type Fields = { name?: string; email?: string; country?: string; phone?: string };

export function SendPanel() {
  const live = useCreator((state) => state.design);
  const hidden = live.pieces.filter((piece) => !piece.visible);
  const problem = useMemo(() => (live.pieces.length ? designProblem(live) : null), [live]);
  const images = useCreator((state) => state.images);
  const markSent = useCreator((state) => state.markSent);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    useCreator.getState().finishDrawing();
    const { design } = useCreator.getState();
    const blocked = designProblem(design);
    if (blocked) {
      setError(blocked);
      return;
    }
    const body = form;
    body.set("design", JSON.stringify(visibleDesign(design)));
    images.forEach((image) => body.append("images", image.file));
    setPending(true);
    setError(null);
    setFields({});
    try {
      const response = await fetch("/api/bespoke", { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; reference?: string; link?: string; error?: string; fields?: Fields };
      if (result.ok && result.reference && result.link) {
        markSent({ reference: result.reference, link: result.link });
        return;
      }
      setFields(result.fields ?? {});
      setError(result.error ?? (result.fields ? null : "We could not send your design. Try again."));
    } catch {
      setError("We could not reach the workshop. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Group title="Send to our workshop" note="We review every design by hand, then email you a final price. You pay nothing now." >
        <FormField label="Name" error={fields.name}>
          <input name="name" autoComplete="name" required maxLength={120} aria-invalid={Boolean(fields.name)} className={FIELD} />
        </FormField>
        <FormField label="Email" error={fields.email}>
          <input name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={Boolean(fields.email)} className={FIELD} />
        </FormField>
        <FormField label="Country" error={fields.country}>
          <select name="country" autoComplete="country" required defaultValue="" aria-invalid={Boolean(fields.country)} className={FIELD}>
            <option value="" disabled>Choose a country</option>
            {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </FormField>
        <FormField label="Phone" error={fields.phone} hint="Optional.">
          <input name="phone" type="tel" autoComplete="tel" maxLength={30} aria-invalid={Boolean(fields.phone)} className={FIELD} />
        </FormField>
      </Group>
      <p className={`text-[12px] leading-snug ${SECONDARY}`}>{BESPOKE_NOTE}</p>
      {hidden.length ? <p role="status" className="rounded-[14px] bg-fg/10 px-3 py-2 text-[13px]">{hidden.map((piece) => piece.name).join(", ")} {hidden.length === 1 ? "is" : "are"} hidden and will not be sent or priced.</p> : null}
      {problem ? <p role="alert" className="text-[13px] text-danger">{problem}</p> : null}
      {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
      <motion.button type="submit" disabled={pending || Boolean(problem)} whileTap={{ scale: 0.97 }} transition={PRESS} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-invert-bg px-6 text-[14px] font-medium text-invert-fg transition-opacity duration-200 hover:opacity-90 disabled:opacity-60">
        {pending ? <CircleNotch size={16} className="animate-spin" aria-hidden /> : null}
        {pending ? "Sending" : "Send to our workshop"}
        {pending ? null : <ArrowRight size={16} aria-hidden />}
      </motion.button>
    </form>
  );
}

export function Confirmation({ reference, link }: { reference: string; link: string }) {
  const startOver = useCreator((state) => state.startOver);
  const steps = ["We review your design and check how it can be made.", "We email you a final price.", "Work starts after you accept it."];
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4 pt-[84px]">
      <section className={`${GLASS_PANEL} grid w-full max-w-[520px] gap-5 rounded-[32px] p-6 md:p-9`} aria-labelledby="sent-title">
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-invert-bg text-invert-fg"><Check size={20} weight="bold" /></span>
        <div>
          <h1 id="sent-title" className="font-display text-[38px] leading-[1.05] tracking-[-0.01em] md:text-[46px]">Your design is with our workshop</h1>
          <p className="mt-3 text-[15px]">Your reference is <strong className="font-medium tabular-nums" data-testid="reference">{reference}</strong>. We have sent a confirmation to your email.</p>
        </div>
        <div>
          <h2 className="text-[13px] font-medium">What happens next</h2>
          <ol className="mt-2 grid gap-2 text-[14px]">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fg/10 text-[12px] font-medium tabular-nums">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>{BESPOKE_NOTE}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={link} className="flex min-h-11 items-center rounded-full border border-fg/20 px-5 text-[13px] font-medium hover:bg-fg/10">Follow your request</Link>
          <button type="button" onClick={startOver} className="flex min-h-11 items-center rounded-full bg-invert-bg px-5 text-[13px] font-medium text-invert-fg hover:opacity-90">Design another</button>
          <Link href="/shop/women" className="flex min-h-11 items-center rounded-full border border-fg/20 px-5 text-[13px] font-medium hover:bg-fg/10">Back to the shop</Link>
        </div>
      </section>
    </div>
  );
}

function download(name: string, type: string, data: BlobPart) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const fileBase = (name: string) => (name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "occuin-design");

export function SavedPanel() {
  const design = useCreator((state) => state.design);
  const savedId = useCreator((state) => state.savedId);
  const savedName = useCreator((state) => state.savedName);
  const markSaved = useCreator((state) => state.markSaved);
  const loadDesign = useCreator((state) => state.loadDesign);
  const [name, setName] = useState(savedName || design.name);
  const [items, setItems] = useState<SavedBespoke[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refresh = () => listSavedBespoke().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    let live = true;
    listSavedBespoke().then((rows) => {
      if (live) setItems(rows);
    }).catch(() => {
      if (live) setItems([]);
    });
    return () => {
      live = false;
    };
  }, []);

  async function run(task: () => Promise<{ error?: string } | object>, done: string) {
    setPending(true);
    setMessage(null);
    setLink(null);
    try {
      const result = await task();
      setMessage("error" in result && result.error ? result.error : done);
      await refresh();
    } catch {
      setMessage("We could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  const save = (id: string | null) =>
    run(async () => {
      const result = await saveBespoke({ id, name, design });
      if ("id" in result && result.id) markSaved(result.id, name);
      return result;
    }, "Saved.");

  const share = async (id: string) => {
    setPending(true);
    setMessage(null);
    const result = await shareSavedBespoke(id).catch(() => ({ error: "We could not make a link. Try again." }));
    setPending(false);
    if ("link" in result && result.link) {
      setLink(`${window.location.origin}${result.link}`);
      setMessage("Anyone with this link can view this design, but not change it. A new link replaces the old one.");
    } else setMessage("error" in result ? (result.error ?? null) : null);
  };

  const hasContent = design.pieces.some((piece) => isSolidPanel(piece) || piece.kind === "tube");

  return (
    <div className="grid gap-5">
      <Group title="Save this design" note="Saved to your account, or to this browser if you are not signed in.">
        <FormField label="Name">
          <input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending || !name.trim()} onClick={() => save(savedId)} className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-invert-bg px-4 text-[13px] font-medium text-invert-fg disabled:opacity-50">{savedId ? "Save changes" : "Save design"}</button>
          {savedId ? <button type="button" disabled={pending || !name.trim()} onClick={() => save(null)} className="min-h-11 rounded-full border border-fg/20 px-4 text-[13px] font-medium hover:bg-fg/10 disabled:opacity-50">Save as new</button> : null}
        </div>
      </Group>
      <Group title="Download">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!hasContent} onClick={() => download(`${fileBase(design.name || name)}.svg`, "image/svg+xml", designSvg(design) ?? "")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-fg/20 text-[13px] font-medium hover:bg-fg/10 disabled:opacity-40"><DownloadSimple size={16} aria-hidden />SVG</button>
          <button type="button" disabled={!hasContent} onClick={() => download(`${fileBase(design.name || name)}.pdf`, "application/pdf", customerPdf(design).slice().buffer as ArrayBuffer)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-fg/20 text-[13px] font-medium hover:bg-fg/10 disabled:opacity-40"><DownloadSimple size={16} aria-hidden />PDF</button>
        </div>
      </Group>
      <Group title="Your designs">
        {message ? <p role="status" className="text-[13px]">{message}</p> : null}
        {link ? <input readOnly aria-label="Share link" value={link} onFocus={(event) => event.target.select()} className={FIELD} /> : null}
        {items === null ? <p className={`text-[13px] ${SECONDARY}`}>Loading</p> : null}
        {items?.length === 0 ? <p className={`text-[13px] ${SECONDARY}`}>Nothing saved yet.</p> : null}
        <ul className="grid gap-2">
          {items?.map((item) => (
            <li key={item.id} className="grid gap-1 rounded-[16px] bg-fg/[0.06] p-2.5">
              <p className="truncate text-[13px] font-medium">{item.name}</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => loadDesign(item.design, item.id, item.name)} className="min-h-9 rounded-full px-2.5 text-[12px] font-medium hover:bg-fg/10">Open</button>
                <button type="button" disabled={pending} onClick={() => run(() => duplicateSavedBespoke(item.id), "Duplicated.")} className="min-h-9 rounded-full px-2.5 text-[12px] font-medium hover:bg-fg/10">Duplicate</button>
                <button type="button" disabled={pending} onClick={() => share(item.id)} className="min-h-9 rounded-full px-2.5 text-[12px] font-medium hover:bg-fg/10">Share</button>
                <button type="button" disabled={pending} onClick={() => run(() => deleteSavedBespoke(item.id), "Deleted.")} className="min-h-9 rounded-full px-2.5 text-[12px] font-medium hover:bg-fg/10">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}
