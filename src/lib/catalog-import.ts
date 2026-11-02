import { z } from "zod";
import { parseCsv, restoreCell } from "./csv";
import { IMAGE_PATH, MAX_PRODUCT_IMAGES, mediaIdOf } from "./media";

export const CSV_COLUMNS = ["product_slug", "product_name", "description", "composition", "category_slug", "images", "audiences", "featured", "active", "sku", "color", "size", "price", "stock"] as const;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_CHARS = 3_500_000;

const LIST_SEPARATOR = "|";
const MAX_STOCK = 1_000_000;
const PRODUCT_FIELDS = ["product_name", "description", "composition", "category_slug", "images", "audiences", "featured", "active"] as const;

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  composition: string;
  categorySlug: string;
  images: string[];
  audiences: string[];
  featured: boolean;
  active: boolean;
};
export type CatalogVariant = { id: string; productId: string; sku: string; color: string; size: string; priceCents: number; stock: number };
export type Catalog = { categories: string[]; mediaIds: string[]; products: CatalogProduct[]; variants: CatalogVariant[] };

type ProductValues = Omit<CatalogProduct, "id">;
type VariantValues = Pick<CatalogVariant, "sku" | "color" | "size" | "priceCents" | "stock">;

export type ProductOp = { id: string | null; slug: string; values: ProductValues; changes: string[] };
export type VariantOp = { id: string | null; productSlug: string; values: VariantValues; previousStock: number | null; changes: string[] };
export type ImportIssue = { line: number; message: string };
export type ImportPlan = { issues: ImportIssue[]; rows: number; products: ProductOp[]; variants: VariantOp[]; unchanged: number };

const boolean = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === "true" || value === "false", "Use true or false.")
  .transform((value) => value === "true");

const list = (value: string) => value.split(LIST_SEPARATOR).map((item) => item.trim()).filter(Boolean);

const rowSchema = z.object({
  product_slug: z.string().trim().max(120, "Keep the slug under 120 characters.").regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens in the slug."),
  product_name: z.string().trim().min(1, "Enter a name.").max(120, "Keep the name under 120 characters."),
  description: z.string().trim().min(1, "Enter a description.").max(4000, "Keep the description under 4000 characters."),
  composition: z.string().trim().min(1, "Enter the composition.").max(1000, "Keep the composition under 1000 characters."),
  category_slug: z.string().trim().min(1, "Enter a category slug."),
  images: z
    .string()
    .transform(list)
    .pipe(
      z
        .array(z.string().regex(IMAGE_PATH, "Each image must be an uploaded image or a path under /images."))
        .min(1, "Add at least one image.")
        .max(MAX_PRODUCT_IMAGES, `Use at most ${MAX_PRODUCT_IMAGES} images.`),
    ),
  audiences: z
    .string()
    .transform((value) => [...new Set(list(value.toLowerCase()))])
    .pipe(z.array(z.enum(["women", "men"], "Audiences must be women, men or women|men.")).min(1, "Choose women, men or women|men.")),
  featured: boolean,
  active: boolean,
  sku: z
    .string()
    .trim()
    .min(1, "Enter a SKU.")
    .max(80, "Keep the SKU under 80 characters.")
    .regex(/^\S+$/, "A SKU cannot contain spaces.")
    .transform((value) => value.toUpperCase()),
  color: z.string().trim().min(1, "Enter a colour.").max(60, "Keep the colour under 60 characters."),
  size: z.string().trim().min(1, "Enter a size.").max(30, "Keep the size under 30 characters."),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a price such as 1250 or 1250.50.")
    .transform((value) => Math.round(Number(value) * 100))
    .refine((cents) => cents > 0, "The price must be above zero."),
  stock: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter stock as a whole number, 0 or more.")
    .transform(Number)
    .refine((stock) => stock <= MAX_STOCK, "Stock cannot exceed 1,000,000."),
});

type Row = z.infer<typeof rowSchema> & { line: number; raw: Record<string, string> };

function readRows(text: string): { rows: Row[]; issues: ImportIssue[] } {
  const { records, error } = parseCsv(text);
  if (error) return { rows: [], issues: [{ line: 1, message: error }] };
  const [header, ...body] = records;
  if (!header) return { rows: [], issues: [{ line: 1, message: "The file is empty." }] };
  const names = header.cells.map((cell) => cell.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((column) => !names.includes(column));
  if (missing.length) return { rows: [], issues: [{ line: header.line, message: `Missing columns: ${missing.join(", ")}.` }] };
  if (!body.length) return { rows: [], issues: [{ line: header.line, message: "The file has no product rows." }] };
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], issues: [{ line: header.line, message: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` }] };

  const rows: Row[] = [];
  const issues: ImportIssue[] = [];
  for (const { line, cells } of body) {
    if (cells.length !== names.length) {
      issues.push({ line, message: `Expected ${names.length} cells, found ${cells.length}.` });
      continue;
    }
    const raw = Object.fromEntries(names.map((name, index) => [name, restoreCell(cells[index]!)]));
    const parsed = rowSchema.safeParse(raw);
    if (parsed.success) rows.push({ ...parsed.data, line, raw });
    else issues.push(...parsed.error.issues.map((issue) => ({ line, message: issue.message })));
  }
  return { rows, issues };
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);
const sameSet = (a: string[], b: string[]) => sameList([...a].sort(), [...b].sort());
const optionKey = (color: string, size: string) => `${color.toLowerCase()}|${size.toLowerCase()}`;

function productChanges(current: CatalogProduct, next: ProductValues) {
  return [
    current.name !== next.name && `Name: ${current.name} to ${next.name}`,
    current.description !== next.description && "Description changed",
    current.composition !== next.composition && "Composition changed",
    current.categorySlug !== next.categorySlug && `Category: ${current.categorySlug} to ${next.categorySlug}`,
    !sameList(current.images, next.images) && `Images: ${current.images.length} to ${next.images.length}, order or files changed`,
    !sameSet(current.audiences, next.audiences) && `Audiences: ${current.audiences.join(", ")} to ${next.audiences.join(", ")}`,
    current.featured !== next.featured && `Featured: ${current.featured} to ${next.featured}`,
    current.active !== next.active && `Active: ${current.active} to ${next.active}`,
  ].filter((change): change is string => Boolean(change));
}

function variantChanges(current: CatalogVariant, next: VariantValues) {
  return [
    current.color !== next.color && `Colour: ${current.color} to ${next.color}`,
    current.size !== next.size && `Size: ${current.size} to ${next.size}`,
    current.priceCents !== next.priceCents && `Price: ${(current.priceCents / 100).toFixed(2)} to ${(next.priceCents / 100).toFixed(2)}`,
    current.stock !== next.stock && `Stock: ${current.stock} to ${next.stock}`,
  ].filter((change): change is string => Boolean(change));
}

export function planImport(text: string, catalog: Catalog): ImportPlan {
  const { rows, issues } = readRows(text);
  const categories = new Set(catalog.categories);
  const mediaIds = new Set(catalog.mediaIds);
  const productBySlug = new Map(catalog.products.map((product) => [product.slug, product]));
  const variantBySku = new Map(catalog.variants.map((variant) => [variant.sku, variant]));

  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.product_slug, [...(groups.get(row.product_slug) ?? []), row]);

  const products: ProductOp[] = [];
  const variants: VariantOp[] = [];
  const seenSkus = new Set<string>();
  let unchanged = 0;

  for (const [slug, group] of groups) {
    const first = group[0]!;
    const existing = productBySlug.get(slug);
    if (!categories.has(first.category_slug)) issues.push({ line: first.line, message: `Category ${first.category_slug} does not exist.` });
    for (const path of first.images) {
      const id = mediaIdOf(path);
      if (id && !mediaIds.has(id)) issues.push({ line: first.line, message: `Image ${path} is not in the media library.` });
    }
    for (const row of group.slice(1)) {
      const differing = PRODUCT_FIELDS.filter((field) => row.raw[field]?.trim() !== first.raw[field]?.trim());
      if (differing.length) issues.push({ line: row.line, message: `${slug} has different ${differing.join(", ")} here than on line ${first.line}.` });
    }

    const values: ProductValues = {
      slug,
      name: first.product_name,
      description: first.description,
      composition: first.composition,
      categorySlug: first.category_slug,
      images: first.images,
      audiences: first.audiences,
      featured: first.featured,
      active: first.active,
    };
    const changes = existing ? productChanges(existing, values) : [];
    if (!existing) products.push({ id: null, slug, values, changes: ["New product"] });
    else if (changes.length) products.push({ id: existing.id, slug, values, changes });
    else unchanged++;

    const options = new Map<string, number>();
    const claimed = new Set<string>();
    for (const row of group) {
      if (seenSkus.has(row.sku)) issues.push({ line: row.line, message: `SKU ${row.sku} appears more than once in this file.` });
      seenSkus.add(row.sku);
      const current = variantBySku.get(row.sku);
      if (current && current.productId !== existing?.id) issues.push({ line: row.line, message: `SKU ${row.sku} already belongs to another product.` });
      if (current) claimed.add(current.id);
      const option = optionKey(row.color, row.size);
      if (options.has(option)) issues.push({ line: row.line, message: `${row.color}, ${row.size} is listed twice for ${slug}, also on line ${options.get(option)}.` });
      options.set(option, row.line);

      const next: VariantValues = { sku: row.sku, color: row.color, size: row.size, priceCents: row.price, stock: row.stock };
      const variantChange = current ? variantChanges(current, next) : ["New variant"];
      if (!current) variants.push({ id: null, productSlug: slug, values: next, previousStock: null, changes: variantChange });
      else if (variantChange.length) variants.push({ id: current.id, productSlug: slug, values: next, previousStock: current.stock, changes: variantChange });
      else unchanged++;
    }
    if (existing) {
      for (const variant of catalog.variants) {
        if (variant.productId !== existing.id || claimed.has(variant.id)) continue;
        const line = options.get(optionKey(variant.color, variant.size));
        if (line) issues.push({ line, message: `${variant.sku} already uses this colour and size on ${slug}.` });
      }
    }
  }

  return { issues: issues.sort((a, b) => a.line - b.line), rows: rows.length, products, variants, unchanged };
}

export const MAX_PRICE_CENTS = 999_999_999;

export const repricedCents = (cents: number, percent: number) => Math.round((cents * (1000 + Math.round(percent * 10))) / 1000);
