import type { ProductFilters } from "@/lib/server/catalog";

export type RawParams = Record<string, string | string[] | undefined>;
export type Sort = NonNullable<ProductFilters["sort"]>;

export const PAGE_SIZE = 12;

export const SORTS: { value: Sort; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
];

export const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: "Under $50", max: 50 },
  { label: "$50 to $150", min: 50, max: 150 },
  { label: "$150 to $250", min: 150, max: 250 },
  { label: "Over $250", min: 250 },
];

export type ShopState = {
  colors: string[];
  sizes: string[];
  min?: number;
  max?: number;
  sort: Sort;
  page: number;
};

const list = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);

function wholeNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return value !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseShopState(raw: RawParams): ShopState {
  const sort = SORTS.find((option) => option.value === raw.sort)?.value ?? "new";
  return {
    colors: list(raw.color),
    sizes: list(raw.size),
    min: wholeNumber(raw.min),
    max: wholeNumber(raw.max),
    sort,
    page: Math.max(wholeNumber(raw.page) ?? 1, 1),
  };
}

export function toFilters(state: ShopState): ProductFilters {
  return {
    colors: state.colors,
    sizes: state.sizes,
    minCents: state.min === undefined ? undefined : state.min * 100,
    maxCents: state.max === undefined ? undefined : state.max * 100,
    sort: state.sort,
  };
}

export function shopHref(path: string, state: ShopState, patch: Partial<ShopState>) {
  const next = { ...state, page: 1, ...patch };
  const query = new URLSearchParams();
  next.colors.forEach((color) => query.append("color", color));
  next.sizes.forEach((size) => query.append("size", size));
  if (next.min !== undefined) query.set("min", String(next.min));
  if (next.max !== undefined) query.set("max", String(next.max));
  if (next.sort !== "new") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export const toggled = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export const activeFilterCount = (state: ShopState) =>
  state.colors.length + state.sizes.length + (state.min !== undefined || state.max !== undefined ? 1 : 0);

const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function sizeRank(size: string) {
  const letter = LETTER_SIZES.indexOf(size);
  if (letter >= 0) return letter;
  const numeric = Number(size);
  return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : LETTER_SIZES.length + numeric;
}

export const compareSizes = (a: string, b: string) => sizeRank(a) - sizeRank(b);
