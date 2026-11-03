import { COLORS, type DesignSpec } from "@/lib/studio/spec";
export { cleanInitials, INITIALS_PATTERN, withInitials } from "@/lib/studio/initials";

export type Dimensions = { width: number; height: number; depth: number; taper?: number };

export type Everyday = {
  key: string;
  name: string;
  phrase: string;
  width: number;
  height: number;
  depth: number;
  shape: "page" | "laptop" | "phone" | "bottle" | "card" | "book";
};

export const EVERYDAY: Everyday[] = [
  { key: "card", name: "Bank card", phrase: "a bank card", width: 86, height: 54, depth: 1, shape: "card" },
  { key: "phone", name: "Phone, 6.1 inch", phrase: "a 6.1 inch phone", width: 72, height: 147, depth: 8, shape: "phone" },
  { key: "passport", name: "Passport", phrase: "a passport", width: 88, height: 125, depth: 5, shape: "book" },
  { key: "a5", name: "A5 notebook", phrase: "an A5 notebook", width: 148, height: 210, depth: 12, shape: "book" },
  { key: "bottle", name: "Water bottle, 500 ml", phrase: "a 500 ml water bottle", width: 70, height: 230, depth: 70, shape: "bottle" },
  { key: "a4", name: "A4 page", phrase: "an A4 page", width: 210, height: 297, depth: 3, shape: "page" },
  { key: "laptop13", name: "13 inch laptop", phrase: "a 13 inch laptop", width: 304, height: 212, depth: 15, shape: "laptop" },
  { key: "laptop15", name: "15 inch laptop", phrase: "a 15 inch laptop", width: 340, height: 238, depth: 15, shape: "laptop" },
];

const SEAM_ALLOWANCE = 12;
export const FIT_BASIS = "Measured on the outside. A fit leaves about 6 mm a side for seams and lining, with the item laid flat.";
const DEPTH_ALLOWANCE = 4;

export function fitsInside(bag: Dimensions, item: Pick<Everyday, "width" | "height" | "depth">) {
  const width = bag.width * Math.min(bag.taper ?? 1, 1) - SEAM_ALLOWANCE;
  const height = bag.height - SEAM_ALLOWANCE;
  const depth = bag.depth - DEPTH_ALLOWANCE;
  const sides = [item.width, item.height, item.depth].sort((a, b) => a - b) as [number, number, number];
  const room = [width, height, depth].sort((a, b) => a - b) as [number, number, number];
  return sides.every((side, index) => side <= room[index]!);
}

export function comparisons(bag: Dimensions) {
  const longest = Math.max(bag.width, bag.height);
  return EVERYDAY.filter((item) => Math.max(item.width, item.height) <= longest * 1.7 && Math.max(item.width, item.height) >= longest * 0.18).map((item) => ({
    ...item,
    fits: fitsInside(bag, item),
  }));
}

export const centimetres = (mm: number) => {
  const value = mm / 10;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} cm`;
};

export function carryNotes(spec: DesignSpec) {
  const { handles, handleDrop, strap, strapLength } = spec.carry;
  const notes: string[] = [];
  if (handles) notes.push(`${handles === 2 ? "Two top handles" : "A top handle"}, ${centimetres(handleDrop)} drop`);
  if (strap) notes.push(`Shoulder strap, ${centimetres(strapLength)} long`);
  if (!handles && !strap) notes.push(spec.form.depth < 40 ? "Carried in the hand or a pocket" : "Carried in the hand");
  return notes;
}

export function presetMatches(spec: DesignSpec | null, colours: string[]) {
  if (!spec) return false;
  const name = COLORS[spec.panels.primary.color].name.toLowerCase();
  return colours.some((colour) => colour.trim().toLowerCase() === name);
}
