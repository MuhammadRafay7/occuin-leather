import { FINISHES, type FinishKey } from "./spec";

type Grain = (typeof FINISHES)[FinishKey]["grain"];

export const GRAIN_FILE: Record<Grain, string> = { smooth: "box", pebble: "pebble", saffiano: "saffiano", croc: "croc", suede: "suede" };

export function grainTileUrls(finish: FinishKey, suffix: string) {
  const file = GRAIN_FILE[FINISHES[finish].grain];
  return { normal: `/textures/${file}-normal${suffix}.webp`, detail: `/textures/${file}-detail${suffix}.webp` };
}
