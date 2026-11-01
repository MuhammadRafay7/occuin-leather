"use client";

import { create } from "zustand";
import { blankDesign, DEFAULT_LEATHER, designSchema, fullPointCount, LIMITS, uniqueName, type BespokeDesign, type BespokePiece, type BespokePoint, type DesignView, type HardwareKind } from "@/lib/bespoke/design";
import { bakeMirror, boundsOf, clampToBoard, contains, groupBounds, halfChain, insertOnEdge, isSolidPanel, layerOrder, mapPiece, nearestEdge, outlineOf, parentAt, pieceBounds, reflection, scaling, starterPoints, type StarterKind, type Vec } from "@/lib/bespoke/outline";
import { applyPart } from "@/lib/bespoke/parts";
import { readLocal, writeLocal } from "@/lib/local-store";

const DRAFT_KEY = "occuin-bespoke-draft";
const GUIDE_KEY = "occuin-bespoke-guided";
const HISTORY_LIMIT = 120;
const COALESCE_MS = 700;
const SNAP_MM = 5;
const FREE_MM = 0.1;
const AXIS_STICK_MM = 5;
const PASTE_OFFSET_MM = 20;
const STARTER_SIZES = [{ width: 280, height: 220 }, { width: 150, height: 110 }];

export type Tool = "select" | "hand" | "draw" | "tube" | "add" | "hardware" | "measure" | "reflect";
export type ReferenceImage = { id: string; file: File; url: string };
export type AlignEdge = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
type Measure = { a: Vec; b: Vec };
type Hardware = BespokePiece["hardware"][number];

type State = {
  phase: "loading" | "ready";
  restored: boolean;
  design: BespokeDesign;
  past: BespokeDesign[];
  future: BespokeDesign[];
  anchor: BespokeDesign | null;
  coalesce: { key: string; at: number } | null;
  selectedId: string | null;
  others: string[];
  pointIndex: number | null;
  hardwareId: string | null;
  drawingId: string | null;
  activeView: DesignView;
  tool: Tool;
  hardwareKind: HardwareKind;
  snap: boolean;
  mirror: boolean;
  axisX: number;
  additive: boolean;
  reflectCopy: boolean;
  leatherView: boolean;
  measure: Measure | null;
  clipboard: BespokePiece[];
  helpOpen: boolean;
  libraryOpen: boolean;
  guideStep: number | null;
  notice: string | null;
  images: ReferenceImage[];
  sent: { reference: string; link: string } | null;
  savedId: string | null;
  savedName: string;
};

type Actions = {
  start: (initial?: { design: BespokeDesign; id: string | null; name: string } | null) => void;
  startOver: () => void;
  loadDesign: (design: BespokeDesign, id?: string | null, name?: string) => void;
  undo: () => void;
  redo: () => void;
  setTool: (tool: Tool) => void;
  setHardwareKind: (kind: HardwareKind) => void;
  toggleSnap: () => void;
  toggleMirror: () => void;
  setAxisX: (x: number) => void;
  toggleAdditive: () => void;
  toggleReflectCopy: () => void;
  toggleLeatherView: () => void;
  setView: (view: DesignView) => void;
  setHelp: (open: boolean) => void;
  setLibrary: (open: boolean) => void;
  placePart: (key: string) => void;
  setGuide: (step: number | null) => void;
  setMeasure: (measure: Measure | null) => void;
  addStarter: (kind: StarterKind) => void;
  placePoint: (point: Vec) => void;
  closeShape: () => void;
  finishDrawing: () => void;
  selectPiece: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
  toggleInSelection: (id: string) => void;
  selectAll: () => void;
  selectPoint: (index: number | null) => void;
  selectHardware: (pieceId: string, hardwareId: string) => void;
  beginGesture: () => void;
  endGesture: () => void;
  cancelGesture: () => void;
  dragPoint: (index: number, point: Vec) => void;
  dragGroup: (origins: BespokePiece[], dx: number, dy: number) => void;
  transformGroup: (origins: BespokePiece[], transform: (point: Vec) => Vec, spin?: number) => void;
  dragHardware: (pieceId: string, hardwareId: string, point: Vec) => void;
  dragFold: (end: "a" | "b", point: Vec) => void;
  addPointOnEdge: (point: Vec, tolerance: number) => boolean;
  deletePoint: () => void;
  deleteSelection: () => void;
  togglePointSmooth: () => void;
  stepPoint: (delta: 1 | -1) => void;
  nudge: (dx: number, dy: number) => void;
  updatePiece: (id: string, patch: Partial<BespokePiece>, coalesceKey?: string) => void;
  duplicatePiece: (id: string) => void;
  duplicateSelection: () => void;
  removePiece: (id: string) => void;
  moveLayer: (id: string, direction: 1 | -1) => void;
  updateDesign: (patch: Partial<BespokeDesign>, coalesceKey?: string) => void;
  toggleCutout: (id: string) => void;
  toggleFold: (id: string) => void;
  placeHardware: (point: Vec) => void;
  updateHardware: (pieceId: string, hardwareId: string, patch: Partial<Hardware>, coalesceKey?: string) => void;
  removeHardware: (pieceId: string, hardwareId: string) => void;
  align: (edge: AlignEdge) => void;
  distribute: (axis: "x" | "y") => void;
  setGroupSize: (width: number | null, height: number | null) => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  reflect: (a: Vec, b: Vec) => void;
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  markSent: (sent: { reference: string; link: string }) => void;
  markSaved: (id: string, name: string) => void;
  placeLogo: (id: string, rightsConfirmed: boolean) => void;
  dragLogo: (pieceId: string, point: Vec) => void;
  dismissNotice: () => void;
};

const newId = () => Math.random().toString(36).slice(2, 12).padEnd(6, "0");

export const nextName = uniqueName;

function newPiece(pieces: BespokePiece[], points: BespokePoint[], patch: Partial<BespokePiece>): BespokePiece {
  const previous = pieces[pieces.length - 1];
  return {
    id: newId(),
    name: nextName(pieces),
    kind: "panel",
    view: "front",
    logo: null,
    points,
    closed: false,
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
    finish: previous?.finish ?? DEFAULT_LEATHER.finish,
    color: previous?.color ?? DEFAULT_LEATHER.color,
    thread: previous?.thread ?? "ivory",
    stitched: previous?.stitched ?? true,
    stack: previous?.stack ?? 0,
    text: null,
    ...patch,
  };
}

const quantiser = (snap: boolean) => {
  const step = snap ? SNAP_MM : FREE_MM;
  return (v: number) => Number((Math.round(v / step) * step).toFixed(1));
};

function settle(value: Vec, snap: boolean, mirrored: boolean, axis: number): Vec {
  const quantise = quantiser(snap);
  const { x, y } = clampToBoard({ x: mirrored ? axis + Math.abs(value.x - axis) : value.x, y: value.y });
  return { x: mirrored && x - axis < AXIS_STICK_MM ? axis : quantise(x), y: quantise(y) };
}

export function withCutouts(pieces: BespokePiece[], ids: string[]) {
  const chosen = new Set(ids);
  return pieces.filter((piece) => chosen.has(piece.id) || (piece.holeOf !== null && chosen.has(piece.holeOf)));
}

const canClose = (piece: BespokePiece) => (piece.kind === "tube" ? piece.points.length >= 2 : fullPointCount(piece) >= 3);

function shifted(piece: BespokePiece, dx: number, dy: number): BespokePiece {
  const move = <T extends Vec>(point: T): T => ({ ...point, x: Number((point.x + dx).toFixed(1)), y: Number((point.y + dy).toFixed(1)) });
  const fold = piece.fold ? { ...piece.fold, ax: piece.fold.ax + dx, ay: piece.fold.ay + dy, bx: piece.fold.bx + dx, by: piece.fold.by + dy } : null;
  return { ...piece, points: piece.points.map(move), hardware: piece.hardware.map(move), axisX: piece.axisX + dx, fold };
}

function clampedShift(pieces: BespokePiece[], dx: number, dy: number) {
  const box = groupBounds(pieces);
  return {
    dx: Math.min(LIMITS.halfWidthMm - box.maxX, Math.max(-LIMITS.halfWidthMm - box.minX, dx)),
    dy: Math.min(LIMITS.halfHeightMm - box.maxY, Math.max(-LIMITS.halfHeightMm - box.minY, dy)),
  };
}

export function writeDraft() {
  const { design, phase, sent } = useCreator.getState();
  if (phase !== "ready" || sent) return;
  const pieces = design.pieces.map((piece) => ({
    ...piece,
    name: piece.name.trim() || "Panel",
    text: piece.text?.value.trim() ? piece.text : null,
  }));
  writeLocal(DRAFT_KEY, JSON.stringify({ ...design, pieces }));
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

function readDraft() {
  const raw = readLocal(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = designSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function finishGuide() {
  writeLocal(GUIDE_KEY, "1");
  useCreator.getState().setGuide(null);
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const useCreator = create<State & Actions>((set, get) => {
  const commit = (design: BespokeDesign, extra: Partial<State> = {}) => {
    const { design: current, past } = get();
    set({ design, past: [...past, current].slice(-HISTORY_LIMIT), future: [], coalesce: null, notice: null, ...extra });
  };

  const commitCoalesced = (design: BespokeDesign, key?: string) => {
    const { coalesce } = get();
    const now = Date.now();
    if (key && coalesce?.key === key && now - coalesce.at < COALESCE_MS) {
      set({ design, future: [], coalesce: { key, at: now } });
      return;
    }
    commit(design);
    if (key) set({ coalesce: { key, at: now } });
  };

  const selected = () => {
    const { design, selectedId } = get();
    return design.pieces.find((piece) => piece.id === selectedId) ?? null;
  };

  const group = () => {
    const { design, selectedId, others } = get();
    return withCutouts(design.pieces, [...others, ...(selectedId ? [selectedId] : [])]);
  };

  const replacePiece = (design: BespokeDesign, id: string, patch: Partial<BespokePiece>): BespokeDesign => ({
    ...design,
    pieces: design.pieces.map((piece) => (piece.id === id ? { ...piece, ...patch } : piece)),
  });

  const replaceMany = (design: BespokeDesign, updated: BespokePiece[]): BespokeDesign => {
    const byId = new Map(updated.map((piece) => [piece.id, piece]));
    return { ...design, pieces: design.pieces.map((piece) => byId.get(piece.id) ?? piece) };
  };

  const withoutPieces = (design: BespokeDesign, ids: Set<string>): BespokeDesign => ({
    ...design,
    bodyId: design.bodyId && ids.has(design.bodyId) ? null : design.bodyId,
    pieces: design.pieces.filter((piece) => !ids.has(piece.id) && !(piece.holeOf && ids.has(piece.holeOf))),
  });

  const roomFor = (count = 1) => {
    if (get().design.pieces.length + count <= LIMITS.pieces) return true;
    set({ notice: `A design can have up to ${LIMITS.pieces} pieces.` });
    return false;
  };

  const afterHistory = () => {
    const { design, selectedId, pointIndex, others } = get();
    const piece = design.pieces.find((item) => item.id === selectedId);
    set({
      selectedId: piece ? selectedId : null,
      others: others.filter((id) => design.pieces.some((item) => item.id === id)),
      pointIndex: piece && pointIndex !== null && pointIndex < piece.points.length ? pointIndex : null,
      hardwareId: null,
      drawingId: null,
      notice: null,
      coalesce: null,
    });
  };

  const addCopies = (sources: BespokePiece[], offset: number) => {
    const { design } = get();
    if (!roomFor(sources.length)) return;
    const names: BespokePiece[] = [...design.pieces];
    const idMap = new Map<string, string>();
    const copies = sources.map((source) => {
      const id = newId();
      idMap.set(source.id, id);
      const copy = shifted(source, offset, offset);
      const made: BespokePiece = { ...copy, id, name: nextName(names, `${source.name} copy`.slice(0, LIMITS.pieceName - 3)), hardware: copy.hardware.map((item) => ({ ...item, id: newId() })) };
      names.push(made);
      return made;
    }).map((copy) => (copy.holeOf ? { ...copy, holeOf: idMap.get(copy.holeOf) ?? copy.holeOf } : copy));
    const last = copies[copies.length - 1]!;
    commit({ ...design, pieces: [...design.pieces, ...copies] }, { selectedId: last.id, others: copies.slice(0, -1).map((copy) => copy.id), pointIndex: null, hardwareId: null, tool: "select" });
  };

  return {
    phase: "loading",
    restored: false,
    design: blankDesign(),
    past: [],
    future: [],
    anchor: null,
    coalesce: null,
    selectedId: null,
    others: [],
    pointIndex: null,
    hardwareId: null,
    drawingId: null,
    activeView: "front",
    tool: "draw",
    hardwareKind: "rivet",
    snap: true,
    mirror: false,
    axisX: 0,
    additive: false,
    reflectCopy: true,
    leatherView: false,
    measure: null,
    clipboard: [],
    helpOpen: false,
    libraryOpen: false,
    guideStep: null,
    notice: null,
    images: [],
    sent: null,
    savedId: null,
    savedName: "",

    start: (initial) => {
      if (get().phase === "ready" && !initial) return;
      const guideStep = readLocal(GUIDE_KEY) ? null : 0;
      if (initial) {
        set({ phase: "ready", design: initial.design, savedId: initial.id, savedName: initial.name, tool: "select", guideStep: null, past: [], future: [], selectedId: null, others: [] });
        return;
      }
      const draft = readDraft();
      if (!draft?.pieces.length) {
        set({ phase: "ready", guideStep });
        return;
      }
      const pieces = draft.pieces.flatMap((piece) => (piece.kind === "tube" || piece.closed ? [piece] : canClose(piece) ? [{ ...piece, closed: true }] : []));
      set({ phase: "ready", restored: true, design: { ...draft, pieces }, tool: "select", selectedId: pieces.filter((piece) => piece.view === "front").at(-1)?.id ?? null });
    },

    startOver: () => {
      clearDraft();
      get().images.forEach((image) => URL.revokeObjectURL(image.url));
      set({ design: blankDesign(), past: [], future: [], selectedId: null, others: [], pointIndex: null, hardwareId: null, drawingId: null, tool: "draw", restored: false, images: [], sent: null, notice: null, mirror: false, measure: null, savedId: null, savedName: "" });
    },

    loadDesign: (design, id = null, name = "") => {
      commit(design, { selectedId: null, others: [], pointIndex: null, hardwareId: null, drawingId: null, tool: "select", savedId: id, savedName: name, sent: null });
    },

    undo: () => {
      const { past, design, future } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({ design: previous, past: past.slice(0, -1), future: [design, ...future].slice(0, HISTORY_LIMIT) });
      afterHistory();
    },

    redo: () => {
      const { past, design, future } = get();
      const next = future[0];
      if (!next) return;
      set({ design: next, past: [...past, design], future: future.slice(1) });
      afterHistory();
    },

    setTool: (tool) => {
      get().finishDrawing();
      set({ tool, notice: null, measure: tool === "measure" ? get().measure : null });
    },

    setHardwareKind: (hardwareKind) => set({ hardwareKind, tool: "hardware", notice: null }),

    toggleSnap: () => set((state) => ({ snap: !state.snap })),

    toggleMirror: () => {
      const piece = selected();
      if (piece?.kind === "tube") {
        set({ notice: "A handle cannot mirror. Draw it across the centre line instead." });
        return;
      }
      const on = !(piece ? piece.mirror : get().mirror);
      set({ mirror: on });
      if (!piece) return;
      if (!on) {
        commit(replacePiece(get().design, piece.id, { mirror: false, points: bakeMirror(piece), axisX: 0 }), { pointIndex: null });
        return;
      }
      const box = boundsOf(outlineOf(piece));
      const { axisX } = get();
      const axis = box.minX < axisX && box.maxX > axisX ? axisX : Math.round((box.minX + box.maxX) / 2);
      const points = piece.closed ? halfChain(piece.points, axis) : piece.points.map((point) => ({ ...point, x: axis + Math.abs(point.x - axis) }));
      if (points.length < 2 && piece.closed) {
        set({ notice: "This piece cannot be mirrored about that line." });
        return;
      }
      commit(replacePiece(get().design, piece.id, { mirror: true, axisX: axis, points }), { pointIndex: null });
    },

    setAxisX: (axisX) => set({ axisX: Math.round(Math.min(LIMITS.halfWidthMm, Math.max(-LIMITS.halfWidthMm, axisX))) }),
    toggleAdditive: () => set((state) => ({ additive: !state.additive })),
    toggleReflectCopy: () => set((state) => ({ reflectCopy: !state.reflectCopy })),
    toggleLeatherView: () => set((state) => ({ leatherView: !state.leatherView })),
    setView: (activeView) => {
      get().finishDrawing();
      set({ activeView, selectedId: null, others: [], pointIndex: null, hardwareId: null, measure: null, notice: null });
    },
    setHelp: (helpOpen) => set({ helpOpen }),
    setLibrary: (libraryOpen) => set({ libraryOpen }),

    placePart: (key) => {
      get().finishDrawing();
      const result = applyPart(get().design, key, get().selectedId, newId);
      if ("error" in result) {
        set({ notice: result.error });
        return;
      }
      const last = result.ids[result.ids.length - 1] ?? null;
      commit(result.design, { activeView: result.view, selectedId: last, others: result.ids.slice(0, -1), pointIndex: null, hardwareId: null, drawingId: null, tool: "select", notice: `${result.name} added. You can move and edit it.` });
    },
    setGuide: (guideStep) => set({ guideStep }),
    setMeasure: (measure) => set({ measure }),

    addStarter: (kind) => {
      if (!roomFor()) return;
      get().finishDrawing();
      const { design } = get();
      const size = STARTER_SIZES[design.pieces.length ? 1 : 0]!;
      const onView = design.pieces.filter((item) => item.view === get().activeView).length;
      const piece = newPiece(design.pieces, starterPoints(kind, onView ? STARTER_SIZES[1]!.width : size.width, onView ? STARTER_SIZES[1]!.height : size.height), { closed: true, view: get().activeView });
      commit({ ...design, pieces: [...design.pieces, piece] }, { selectedId: piece.id, others: [], pointIndex: null, hardwareId: null, tool: "select" });
    },

    placePoint: (value) => {
      const { design, snap, mirror, axisX, drawingId, tool, activeView } = get();
      const piece = design.pieces.find((item) => item.id === drawingId);
      if (piece) {
        if (piece.points.length >= LIMITS.points) {
          set({ notice: `A piece can have up to ${LIMITS.points} points.` });
          return;
        }
        const point = { ...settle(value, snap, piece.mirror, piece.axisX), smooth: piece.kind === "tube" };
        const last = piece.points[piece.points.length - 1]!;
        if (last.x === point.x && last.y === point.y) return;
        const points = [...piece.points, point];
        commit(replacePiece(design, piece.id, { points }), { pointIndex: points.length - 1 });
        return;
      }
      if (!roomFor()) return;
      const tube = tool === "tube";
      const mirrored = !tube && mirror;
      const fresh = newPiece(design.pieces, [{ ...settle(value, snap, mirrored, axisX), smooth: tube }], {
        mirror: mirrored,
        axisX: mirrored ? axisX : 0,
        kind: tube ? "tube" : "panel",
        view: activeView,
        name: tube ? nextName(design.pieces, "Handle") : nextName(design.pieces),
      });
      commit({ ...design, pieces: [...design.pieces, fresh] }, { selectedId: fresh.id, others: [], pointIndex: 0, hardwareId: null, drawingId: fresh.id });
    },

    closeShape: () => {
      const { design, drawingId } = get();
      const piece = design.pieces.find((item) => item.id === drawingId);
      if (!piece) return;
      if (!canClose(piece)) {
        set({ notice: piece.kind === "tube" ? "Place at least two points." : "Place at least three points to close the shape." });
        return;
      }
      commit(piece.kind === "tube" ? design : replacePiece(design, piece.id, { closed: true }), { tool: "select", pointIndex: null, drawingId: null });
    },

    finishDrawing: () => {
      const { design, drawingId } = get();
      const piece = design.pieces.find((item) => item.id === drawingId);
      if (!piece) {
        if (drawingId) set({ drawingId: null });
        return;
      }
      if (canClose(piece)) {
        commit(piece.kind === "tube" ? design : replacePiece(design, piece.id, { closed: true }), { pointIndex: null, drawingId: null });
        return;
      }
      commit(withoutPieces(design, new Set([piece.id])), { selectedId: null, pointIndex: null, drawingId: null });
    },

    selectPiece: (id) => {
      if (id === get().selectedId && !get().others.length) return;
      get().finishDrawing();
      set({ selectedId: id, others: [], pointIndex: null, hardwareId: null, notice: null });
    },

    setSelection: (ids) => {
      get().finishDrawing();
      const last = ids[ids.length - 1] ?? null;
      set({ selectedId: last, others: ids.slice(0, -1), pointIndex: null, hardwareId: null, notice: null });
    },

    toggleInSelection: (id) => {
      const { selectedId, others } = get();
      const current = [...others, ...(selectedId ? [selectedId] : [])];
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      get().setSelection(next);
    },

    selectAll: () => get().setSelection(get().design.pieces.filter((piece) => piece.visible && piece.view === get().activeView).map((piece) => piece.id)),

    selectPoint: (index) => set({ pointIndex: index, hardwareId: null, notice: null }),

    selectHardware: (pieceId, hardwareId) => set({ selectedId: pieceId, others: [], pointIndex: null, hardwareId, notice: null }),

    beginGesture: () => set((state) => ({ anchor: state.design })),

    endGesture: () => {
      const { anchor, design, past } = get();
      if (!anchor) return;
      if (anchor === design) {
        set({ anchor: null });
        return;
      }
      set({ anchor: null, past: [...past, anchor].slice(-HISTORY_LIMIT), future: [], coalesce: null });
    },

    cancelGesture: () => {
      const { anchor } = get();
      if (anchor) set({ design: anchor, anchor: null });
    },

    dragPoint: (index, value) => {
      const { design, snap } = get();
      const piece = selected();
      if (!piece) return;
      const position = settle(value, snap, piece.mirror, piece.axisX);
      const points = piece.points.map((point, i) => (i === index ? { ...point, ...position } : point));
      set({ design: replacePiece(design, piece.id, { points }) });
    },

    dragGroup: (origins, dx, dy) => {
      const { design, snap } = get();
      const quantise = quantiser(snap);
      const move = clampedShift(origins, quantise(dx), quantise(dy));
      set({ design: replaceMany(design, origins.map((piece) => shifted(piece, move.dx, move.dy))) });
    },

    transformGroup: (origins, transform, spin = 0) => {
      set({ design: replaceMany(get().design, origins.map((piece) => mapPiece(piece, transform, false, spin))) });
    },

    dragHardware: (pieceId, hardwareId, value) => {
      const { design, snap } = get();
      const piece = design.pieces.find((item) => item.id === pieceId);
      if (!piece) return;
      const at = settle(value, snap, false, 0);
      set({ design: replacePiece(design, pieceId, { hardware: piece.hardware.map((item) => (item.id === hardwareId ? { ...item, ...at } : item)) }) });
    },

    dragFold: (end, value) => {
      const { design, snap } = get();
      const piece = selected();
      if (!piece?.fold) return;
      const at = settle(value, snap, false, 0);
      const fold = end === "a" ? { ...piece.fold, ax: at.x, ay: at.y } : { ...piece.fold, bx: at.x, by: at.y };
      set({ design: replacePiece(design, piece.id, { fold }) });
    },

    addPointOnEdge: (value, tolerance) => {
      const piece = selected();
      if (!piece) return false;
      if (piece.points.length >= LIMITS.points) {
        set({ notice: `A piece can have up to ${LIMITS.points} points.` });
        return false;
      }
      const nearest = nearestEdge(piece, value);
      if (!nearest || nearest.distance > tolerance) return false;
      const { points, index } = insertOnEdge(piece, nearest.edge, nearest.at, nearest.curved);
      commit(replacePiece(get().design, piece.id, { points }), { pointIndex: index });
      return true;
    },

    deletePoint: () => {
      const { pointIndex, design, drawingId } = get();
      const piece = selected();
      if (!piece || pointIndex === null) return;
      const points = piece.points.filter((_, index) => index !== pointIndex);
      if (!points.length) {
        commit(withoutPieces(design, new Set([piece.id])), { selectedId: null, pointIndex: null, drawingId: null });
        return;
      }
      const stays = piece.kind === "tube" ? points.length >= 2 : fullPointCount({ ...piece, points }) >= 3;
      if (piece.id !== drawingId && !stays) {
        set({ notice: piece.kind === "tube" ? "A handle needs at least two points." : "A closed piece needs at least three points." });
        return;
      }
      commit(replacePiece(design, piece.id, { points }), { pointIndex: null });
    },

    deleteSelection: () => {
      const { pointIndex, hardwareId, selectedId, design } = get();
      if (hardwareId && selectedId) {
        get().removeHardware(selectedId, hardwareId);
        return;
      }
      if (pointIndex !== null) {
        get().deletePoint();
        return;
      }
      const ids = group().map((piece) => piece.id);
      if (ids.length) commit(withoutPieces(design, new Set(ids)), { selectedId: null, others: [], pointIndex: null });
    },

    togglePointSmooth: () => {
      const { pointIndex, design } = get();
      const piece = selected();
      if (!piece || pointIndex === null) return;
      const points = piece.points.map((point, index) => (index === pointIndex ? { ...point, smooth: !point.smooth } : point));
      commit(replacePiece(design, piece.id, { points }));
    },

    stepPoint: (delta) => {
      const piece = selected();
      if (!piece) return;
      const { pointIndex } = get();
      const count = piece.points.length;
      const next = pointIndex === null ? (delta > 0 ? 0 : count - 1) : (pointIndex + delta + count) % count;
      set({ pointIndex: next });
    },

    nudge: (dx, dy) => {
      const { pointIndex, design, snap } = get();
      const piece = selected();
      if (!piece) return;
      const step = snap ? SNAP_MM : 1;
      if (pointIndex === null) {
        get().beginGesture();
        get().dragGroup(group(), dx * step, dy * step);
        get().endGesture();
        return;
      }
      const point = piece.points[pointIndex]!;
      const position = settle({ x: point.x + dx * step, y: point.y + dy * step }, snap, piece.mirror, piece.axisX);
      const points = piece.points.map((item, index) => (index === pointIndex ? { ...item, ...position } : item));
      commitCoalesced(replacePiece(design, piece.id, { points }), `nudge-${piece.id}-${pointIndex}`);
    },

    updatePiece: (id, patch, coalesceKey) => {
      commitCoalesced(replacePiece(get().design, id, patch), coalesceKey);
    },

    duplicatePiece: (id) => {
      get().finishDrawing();
      const sources = withCutouts(get().design.pieces, [id]);
      if (sources.length) addCopies(sources, PASTE_OFFSET_MM);
    },

    duplicateSelection: () => {
      get().finishDrawing();
      const sources = group();
      if (sources.length) addCopies(sources, PASTE_OFFSET_MM);
    },

    removePiece: (id) => {
      const { selectedId, tool, others } = get();
      commit(withoutPieces(get().design, new Set([id])), {
        others: others.filter((item) => item !== id),
        ...(selectedId === id ? { selectedId: null, pointIndex: null, hardwareId: null, tool: tool === "add" ? "select" : tool } : {}),
      });
    },

    moveLayer: (id, direction) => {
      const { design } = get();
      const ordered = layerOrder(design.pieces);
      const from = ordered.findIndex((piece) => piece.id === id);
      const to = from + direction;
      const neighbour = ordered[to];
      if (from < 0 || !neighbour) return;
      const moved = { ...ordered[from]!, stack: neighbour.stack };
      const pieces = ordered.filter((_, index) => index !== from);
      pieces.splice(to, 0, moved);
      commit({ ...design, pieces });
    },

    updateDesign: (patch, coalesceKey) => {
      commitCoalesced({ ...get().design, ...patch }, coalesceKey);
    },

    toggleCutout: (id) => {
      const { design } = get();
      const piece = design.pieces.find((item) => item.id === id);
      if (!piece) return;
      if (piece.holeOf) {
        commit(replacePiece(design, id, { holeOf: null }));
        return;
      }
      if (!piece.closed || piece.kind === "tube") {
        set({ notice: "Only a closed shape can be a cut-out." });
        return;
      }
      const parent = parentAt(design.pieces, piece);
      if (!parent) {
        set({ notice: "Move this shape over the piece it should cut, then try again." });
        return;
      }
      commit({ ...replacePiece(design, id, { holeOf: parent.id }), bodyId: design.bodyId === id ? null : design.bodyId });
    },

    toggleFold: (id) => {
      const { design } = get();
      const piece = design.pieces.find((item) => item.id === id);
      if (!piece) return;
      if (piece.fold) {
        commit(replacePiece(design, id, { fold: null }));
        return;
      }
      const box = pieceBounds(piece);
      const y = Math.round((box.minY + box.maxY) / 2);
      commit(replacePiece(design, id, { fold: { ax: Math.round(box.maxX), ay: y, bx: Math.round(box.minX), by: y, angle: 30 } }));
    },

    placeHardware: (value) => {
      const { design, hardwareKind, snap } = get();
      const point = settle(value, snap, false, 0);
      const ordered = layerOrder(design.pieces).filter((piece) => piece.visible && isSolidPanel(piece) && piece.view === get().activeView).reverse();
      const piece = ordered.find((item) => contains(outlineOf(item), value));
      if (!piece) {
        set({ notice: "Place hardware on a piece." });
        return;
      }
      if (piece.hardware.length >= LIMITS.hardwarePerPiece) {
        set({ notice: `A piece can hold up to ${LIMITS.hardwarePerPiece} fittings.` });
        return;
      }
      const item: Hardware = { id: newId(), kind: hardwareKind, ...point, rotation: 0, length: 180, shape: "plain", label: "" };
      commit(replacePiece(design, piece.id, { hardware: [...piece.hardware, item] }), { selectedId: piece.id, others: [], hardwareId: item.id, pointIndex: null });
    },

    updateHardware: (pieceId, hardwareId, patch, coalesceKey) => {
      const { design } = get();
      const piece = design.pieces.find((item) => item.id === pieceId);
      if (!piece) return;
      commitCoalesced(replacePiece(design, pieceId, { hardware: piece.hardware.map((item) => (item.id === hardwareId ? { ...item, ...patch } : item)) }), coalesceKey);
    },

    removeHardware: (pieceId, hardwareId) => {
      const { design } = get();
      const piece = design.pieces.find((item) => item.id === pieceId);
      if (!piece) return;
      commit(replacePiece(design, pieceId, { hardware: piece.hardware.filter((item) => item.id !== hardwareId) }), { hardwareId: null });
    },

    align: (edge) => {
      const pieces = group();
      if (pieces.length < 2) return;
      const box = groupBounds(pieces);
      const moved = pieces.map((piece) => {
        const own = pieceBounds(piece);
        const dx = edge === "left" ? box.minX - own.minX : edge === "right" ? box.maxX - own.maxX : edge === "centerX" ? (box.minX + box.maxX - own.minX - own.maxX) / 2 : 0;
        const dy = edge === "top" ? box.minY - own.minY : edge === "bottom" ? box.maxY - own.maxY : edge === "centerY" ? (box.minY + box.maxY - own.minY - own.maxY) / 2 : 0;
        return shifted(piece, dx, dy);
      });
      commit(replaceMany(get().design, moved));
    },

    distribute: (axis) => {
      const pieces = group();
      if (pieces.length < 3) {
        set({ notice: "Select at least three pieces to distribute." });
        return;
      }
      const bounds = pieces.map((piece) => ({ piece, box: pieceBounds(piece) }));
      const start = (box: ReturnType<typeof pieceBounds>) => (axis === "x" ? box.minX : box.minY);
      const size = (box: ReturnType<typeof pieceBounds>) => (axis === "x" ? box.width : box.height);
      const sorted = bounds.sort((a, b) => start(a.box) - start(b.box));
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const span = start(last.box) + size(last.box) - start(first.box);
      const gap = (span - sorted.reduce((sum, item) => sum + size(item.box), 0)) / (sorted.length - 1);
      let cursor = start(first.box);
      const moved = sorted.map(({ piece, box }) => {
        const delta = cursor - start(box);
        cursor += size(box) + gap;
        return shifted(piece, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
      });
      commit(replaceMany(get().design, moved));
    },

    setGroupSize: (width, height) => {
      const pieces = group();
      if (!pieces.length) return;
      const box = groupBounds(pieces);
      const sx = width && box.width ? width / box.width : 1;
      const sy = height && box.height ? height / box.height : 1;
      const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
      commit(replaceMany(get().design, pieces.map((piece) => mapPiece(piece, scaling(center, sx, sy)))));
    },

    copy: () => {
      const pieces = group();
      if (pieces.length) set({ clipboard: pieces, notice: `${pieces.length === 1 ? pieces[0]!.name : `${pieces.length} pieces`} copied.` });
    },

    cut: () => {
      const pieces = group();
      if (!pieces.length) return;
      set({ clipboard: pieces });
      commit(withoutPieces(get().design, new Set(pieces.map((piece) => piece.id))), { selectedId: null, others: [], pointIndex: null });
    },

    paste: () => {
      const { clipboard } = get();
      if (clipboard.length) addCopies(clipboard, PASTE_OFFSET_MM);
    },

    reflect: (a, b) => {
      const pieces = group();
      if (!pieces.length) {
        set({ notice: "Select a piece first, then draw the mirror line." });
        return;
      }
      if (Math.hypot(a.x - b.x, a.y - b.y) < 2) return;
      const { reflectCopy, design } = get();
      const flip = reflection(a, b);
      const flipped = pieces.map((piece) => mapPiece(piece, flip, true));
      if (!reflectCopy) {
        commit(replaceMany(design, flipped), { tool: "select" });
        return;
      }
      if (!roomFor(flipped.length)) return;
      const copies = flipped.map((piece) => ({ ...piece, id: newId(), name: nextName(design.pieces, `${piece.name} mirrored`.slice(0, LIMITS.pieceName - 3)), hardware: piece.hardware.map((item) => ({ ...item, id: newId() })) }));
      commit({ ...design, pieces: [...design.pieces, ...copies] }, { selectedId: copies[copies.length - 1]!.id, others: copies.slice(0, -1).map((copy) => copy.id), tool: "select", pointIndex: null });
    },

    addImages: (files) => {
      const { images } = get();
      const room = LIMITS.images - images.length;
      const accepted: ReferenceImage[] = [];
      let notice: string | null = null;
      let totalBytes = images.reduce((sum, image) => sum + image.file.size, 0);
      for (const file of files) {
        if (accepted.length >= room) {
          notice = `Add up to ${LIMITS.images} reference images.`;
          break;
        }
        if (!IMAGE_TYPES.has(file.type)) notice = "Reference images must be JPG, PNG or WebP.";
        else if (totalBytes + file.size > LIMITS.imagesTotalBytes) notice = "Reference images must be under 3.5 MB in total.";
        else {
          totalBytes += file.size;
          accepted.push({ id: newId(), file, url: URL.createObjectURL(file) });
        }
      }
      set({ images: [...images, ...accepted], notice });
    },

    removeImage: (id) => {
      const { images } = get();
      const image = images.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.url);
      set({ images: images.filter((item) => item.id !== id) });
    },

    markSent: (sent) => {
      clearDraft();
      set({ sent });
    },

    markSaved: (savedId, savedName) => set({ savedId, savedName }),

    placeLogo: (id, rightsConfirmed) => {
      const piece = selected();
      if (!piece || !isSolidPanel(piece)) {
        set({ notice: "Select a piece first, then add the logo." });
        return;
      }
      const box = boundsOf(outlineOf(piece));
      const logo = { id, x: Math.round((box.minX + box.maxX) / 2), y: Math.round((box.minY + box.maxY) / 2), width: Math.min(60, Math.round(box.width / 2)), rotation: 0, style: "deboss" as const, rightsConfirmed };
      commit(replacePiece(get().design, piece.id, { logo }));
    },

    dragLogo: (pieceId, value) => {
      const { design, snap } = get();
      const piece = design.pieces.find((item) => item.id === pieceId);
      if (!piece?.logo) return;
      set({ design: replacePiece(design, pieceId, { logo: { ...piece.logo, ...settle(value, snap, false, 0) } }) });
    },

    dismissNotice: () => set({ notice: null }),
  };
});

export function useSelectedPiece() {
  return useCreator((state) => state.design.pieces.find((piece) => piece.id === state.selectedId) ?? null);
}

