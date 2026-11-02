export type SheetRow = { label: string; value: string; fields: string[]; swatch?: string; exact?: boolean };
export type SheetSection = { title: string; rows: SheetRow[] };

export const OTHER_SECTION = "Other recorded choices";

export const row = (label: string, value: string, ...fields: string[]): SheetRow => ({ label, value, fields });
export const swatchRow = (label: string, value: string, swatch: string, ...fields: string[]): SheetRow => ({ label, value, swatch, fields });
export const exactRow = (label: string, value: string, ...fields: string[]): SheetRow => ({ label, value, fields, exact: true });

const trimmed = (value: number, places: number) => String(Number(value.toFixed(places)));

export const inches = (mm: number) => `${(mm / 25.4).toFixed(2)} in`;
export const millimetres = (mm: number) => `${trimmed(mm, 1)} mm`;
export const length = (mm: number) => `${millimetres(mm)} (${inches(mm)})`;
export const signedLength = (mm: number) => `${mm > 0 ? "+" : ""}${length(mm)}`;
export const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
export const number = trimmed;

export function leafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.length ? value.flatMap((item, index) => leafPaths(item, `${prefix}${index}.`)) : [prefix.slice(0, -1)];
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length ? entries.flatMap(([key, item]) => leafPaths(item, `${prefix}${key}.`)) : [prefix.slice(0, -1)];
  }
  return [prefix.slice(0, -1)];
}

const covers = (field: string, path: string) => path === field || path.startsWith(`${field}.`);

const valueAt = (source: unknown, path: string) =>
  path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), source);

export function unrepresentedPaths(source: unknown, sections: SheetSection[]) {
  const fields = sections.flatMap((section) => section.rows.flatMap((item) => item.fields));
  return leafPaths(source).filter((path) => !fields.some((field) => covers(field, path)));
}

export function withEverythingShown(source: unknown, sections: SheetSection[]): SheetSection[] {
  const missed = unrepresentedPaths(source, sections);
  if (!missed.length) return sections;
  return [...sections, { title: OTHER_SECTION, rows: missed.map((path) => row(path, String(valueAt(source, path)), path)) }];
}
