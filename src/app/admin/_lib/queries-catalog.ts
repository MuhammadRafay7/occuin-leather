import { and, arrayContains, asc, count, desc, eq, ilike, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { mediaUsage } from "@/lib/server/media";
import { mediaPath } from "@/lib/media";
import { getSettings } from "@/lib/server/settings";
import { PAGE_SIZE } from "./queries";

const { categories, mediaImages, products, reviews, stockMovements, users, variants } = schema;

const contains = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;
const stockTotal = sql<number>`coalesce((select sum(v.stock) from variants v where v.product_id = products.id), 0)`.mapWith(Number);
const stockLowest = sql<number>`coalesce((select min(v.stock) from variants v where v.product_id = products.id), 0)`.mapWith(Number);
const priceLowest = sql<number>`coalesce((select min(v.price_cents) from variants v where v.product_id = products.id), 0)`.mapWith(Number);
const priceHighest = sql<number>`coalesce((select max(v.price_cents) from variants v where v.product_id = products.id), 0)`.mapWith(Number);
const variantCount = sql<number>`(select count(*) from variants v where v.product_id = products.id)`.mapWith(Number);

export const PRODUCT_SORTS = {
  newest: { label: "Newest first", order: [desc(products.createdAt)] },
  oldest: { label: "Oldest first", order: [asc(products.createdAt)] },
  name: { label: "Name A to Z", order: [asc(products.name)] },
  "price-asc": { label: "Price, low to high", order: [asc(priceLowest)] },
  "price-desc": { label: "Price, high to low", order: [desc(priceLowest)] },
  "stock-asc": { label: "Stock, low to high", order: [asc(stockTotal)] },
  "stock-desc": { label: "Stock, high to low", order: [desc(stockTotal)] },
} as const;

export type ProductQuery = { q: string; category: string; status: string; department: string; stock: string; sort: string };

function productFilter({ q, category, status, department, stock }: ProductQuery, lowStockLimit: number): SQL | undefined {
  const stockFilters: Record<string, SQL> = {
    in: sql`${stockTotal} > 0`,
    low: sql`${stockTotal} > 0 and ${stockLowest} <= ${lowStockLimit}`,
    out: sql`${stockTotal} = 0`,
  };
  const statusFilters: Record<string, SQL> = {
    active: eq(products.active, true),
    inactive: eq(products.active, false),
    featured: eq(products.featured, true),
  };
  const departmentFilters: Record<string, SQL> = {
    women: arrayContains(products.audiences, ["women"]),
    men: arrayContains(products.audiences, ["men"]),
    leather: eq(categories.department, "leather"),
  };
  return and(
    q ? or(ilike(products.name, contains(q)), ilike(products.slug, contains(q))) : undefined,
    category ? eq(products.categorySlug, category) : undefined,
    Object.hasOwn(statusFilters, status) ? statusFilters[status] : undefined,
    Object.hasOwn(departmentFilters, department) ? departmentFilters[department] : undefined,
    Object.hasOwn(stockFilters, stock) ? stockFilters[stock] : undefined,
  );
}

export async function countProductsFiltered(query: ProductQuery) {
  const { lowStockLimit } = await getSettings();
  const [row] = await db
    .select({ total: count() })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(productFilter(query, lowStockLimit));
  return row?.total ?? 0;
}

export async function matchingProductIds(query: ProductQuery, limit: number) {
  const { lowStockLimit } = await getSettings();
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(productFilter(query, lowStockLimit))
    .orderBy(asc(products.id))
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function listProductsFiltered(query: ProductQuery, offset: number) {
  const { lowStockLimit } = await getSettings();
  const sort = Object.hasOwn(PRODUCT_SORTS, query.sort) ? PRODUCT_SORTS[query.sort as keyof typeof PRODUCT_SORTS] : PRODUCT_SORTS.newest;
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      active: products.active,
      featured: products.featured,
      image: sql<string | null>`${products.images}[1]`,
      categoryName: categories.name,
      variantCount,
      stock: stockTotal,
      priceLowCents: priceLowest,
      priceHighCents: priceHighest,
    })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(productFilter(query, lowStockLimit))
    .orderBy(...sort.order, asc(products.id))
    .limit(PAGE_SIZE)
    .offset(offset);
}

export const exportRows = () =>
  db
    .select({ product: products, variant: variants })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .orderBy(asc(products.slug), asc(variants.sku));

export function listAllCategories() {
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      department: categories.department,
      position: categories.position,
      productCount: sql<number>`(select count(*) from products p where p.category_slug = categories.slug)`.mapWith(Number),
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.slug));
}

function variantFilter(stock: string, q: string, lowStockLimit: number) {
  const stockFilters: Record<string, SQL | undefined> = {
    low: and(lte(variants.stock, lowStockLimit), eq(products.active, true)),
    out: eq(variants.stock, 0),
  };
  return and(
    Object.hasOwn(stockFilters, stock) ? stockFilters[stock] : undefined,
    q ? or(ilike(variants.sku, contains(q)), ilike(products.name, contains(q))) : undefined,
  );
}

export async function countStock(stock: string, q: string) {
  const { lowStockLimit } = await getSettings();
  const [row] = await db.select({ total: count() }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(variantFilter(stock, q, lowStockLimit));
  return row?.total ?? 0;
}

export async function listStock(stock: string, q: string, offset: number) {
  const { lowStockLimit } = await getSettings();
  return db
    .select({
      id: variants.id,
      sku: variants.sku,
      color: variants.color,
      size: variants.size,
      priceCents: variants.priceCents,
      stock: variants.stock,
      productId: products.id,
      productName: products.name,
      productActive: products.active,
      productImage: sql<string | null>`${products.images}[1]`,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(variantFilter(stock, q, lowStockLimit))
    .orderBy(...(stock === "low" ? [asc(variants.stock)] : []), asc(products.name), asc(variants.sku))
    .limit(PAGE_SIZE)
    .offset(offset);
}

export async function getVariant(id: string) {
  const [row] = await db
    .select({ variant: variants, productName: products.name, productImage: sql<string | null>`${products.images}[1]` })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(variants.id, id));
  return row ?? null;
}

export const countMovements = (variantId: string) => db.$count(stockMovements, eq(stockMovements.variantId, variantId));

export const listMovements = (variantId: string, offset: number) =>
  db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.variantId, variantId))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(PAGE_SIZE)
    .offset(offset);

const mediaColumns = {
  id: mediaImages.id,
  filename: mediaImages.filename,
  width: mediaImages.width,
  height: mediaImages.height,
  byteSize: mediaImages.byteSize,
  createdAt: mediaImages.createdAt,
};
const mediaFilter = (q: string) => (q ? ilike(mediaImages.filename, contains(q)) : undefined);

export const countMedia = (q: string) => db.$count(mediaImages, mediaFilter(q));

export async function listMedia(q: string, offset: number) {
  const rows = await db.select(mediaColumns).from(mediaImages).where(mediaFilter(q)).orderBy(desc(mediaImages.createdAt), asc(mediaImages.id)).limit(PAGE_SIZE).offset(offset);
  const usage = await mediaUsage(rows.map((row) => mediaPath(row.id)));
  return rows.map((row) => {
    const path = mediaPath(row.id);
    return { ...row, path, usedBy: usage.usedBy.get(path) ?? [], orderLines: usage.orderLines.get(path) ?? 0 };
  });
}

export const MEDIA_PICKER_SIZE = 48;

export const listMediaChoices = async () => {
  const rows = await db.select({ id: mediaImages.id, filename: mediaImages.filename }).from(mediaImages).orderBy(desc(mediaImages.createdAt)).limit(MEDIA_PICKER_SIZE);
  return rows.map((row) => ({ path: mediaPath(row.id), filename: row.filename }));
};

export type ReviewQuery = { q: string; state: string; rating: string };

function reviewFilter({ q, state, rating }: ReviewQuery) {
  const stateFilters: Record<string, SQL> = {
    visible: isNull(reviews.hiddenAt),
    hidden: isNotNull(reviews.hiddenAt),
    replied: isNotNull(reviews.reply),
    unanswered: isNull(reviews.reply),
  };
  const stars = Number(rating);
  return and(
    Object.hasOwn(stateFilters, state) ? stateFilters[state] : undefined,
    Number.isInteger(stars) && stars >= 1 && stars <= 5 ? eq(reviews.rating, stars) : undefined,
    q
      ? or(
          ilike(reviews.title, contains(q)),
          ilike(reviews.body, contains(q)),
          ilike(products.name, contains(q)),
          ilike(users.name, contains(q)),
          ilike(users.email, contains(q)),
        )
      : undefined,
  );
}

export async function countReviews(query: ReviewQuery) {
  const [row] = await db
    .select({ total: count() })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(reviewFilter(query));
  return row?.total ?? 0;
}

export const listReviews = (query: ReviewQuery, offset: number) =>
  db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      hiddenAt: reviews.hiddenAt,
      reply: reviews.reply,
      repliedAt: reviews.repliedAt,
      createdAt: reviews.createdAt,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productActive: products.active,
      productImage: sql<string | null>`${products.images}[1]`,
      author: users.name,
      email: users.email,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(reviewFilter(query))
    .orderBy(desc(reviews.createdAt), asc(reviews.id))
    .limit(PAGE_SIZE)
    .offset(offset);
