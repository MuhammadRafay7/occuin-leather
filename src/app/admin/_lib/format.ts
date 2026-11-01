export type SearchParams = Record<string, string | string[] | undefined>;

export function param(search: SearchParams, key: string) {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export type VariantInput = {
  id?: string;
  color: string;
  size: string;
  sku: string;
  price: string;
  stock: string;
  expectedStock?: number;
};

type StoredVariant = { id: string; color: string; size: string; sku: string; priceCents: number; stock: number };

export const variantToInput = (variant: StoredVariant): VariantInput => ({
  id: variant.id,
  color: variant.color,
  size: variant.size,
  sku: variant.sku,
  price: (variant.priceCents / 100).toFixed(2),
  stock: String(variant.stock),
  expectedStock: variant.stock,
});

export const dateTime = (date: Date | string) =>
  `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(date))} UTC`;

export const shortDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
