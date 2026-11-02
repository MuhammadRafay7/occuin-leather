export type SheetAngle = { theta: number; phi: number; spin: number };

const LEVEL = Math.PI / 2 - 0.04;

export const SHEET_VIEWS = {
  threeQuarter: { label: "Three-quarter", theta: -0.5, phi: 1.32, spin: -0.5 },
  front: { label: "Front", theta: 0, phi: LEVEL, spin: 0 },
  back: { label: "Back", theta: Math.PI, phi: LEVEL, spin: Math.PI },
  left: { label: "Left side", theta: -Math.PI / 2, phi: LEVEL, spin: -Math.PI / 2 },
  right: { label: "Right side", theta: Math.PI / 2, phi: LEVEL, spin: Math.PI / 2 },
  top: { label: "Top", theta: 0, phi: 0.12, spin: 0 },
} as const satisfies Record<string, SheetAngle & { label: string }>;

export type SheetView = keyof typeof SHEET_VIEWS;
export const SHEET_VIEW_KEYS = Object.keys(SHEET_VIEWS) as SheetView[];
export const SHOT_PX = 1600;
export const SHOT_BACKGROUND = "#f1f1f1";
export const SHOT_MAX_BYTES = 2_500_000;
export const isSheetView = (value: string): value is SheetView => Object.hasOwn(SHEET_VIEWS, value);
