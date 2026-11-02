import { publicName } from "../format";
import { and, asc, avg, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "./db";

const { categories, products, reviews, users, variants, wishlistItems } = schema;

export type Department = "women" | "men" | "leather";
export const DEPARTMENTS: Record<Department, { name: string; image: string }> = {
  women: { name: "Women", image: "/images/studio/tote.webp" },
  men: { name: "Men", image: "/images/studio/laptop.webp" },
  leather: { name: "All leather", image: "/images/studio/tote.webp" },
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  image: string;
  hoverImage: string | null;
  priceCents: number;
  colors: string[];
  sizes: string[];
  soldOut: boolean;
  featured: boolean;
  category: string;
  categoryName: string;
  department: Department;
  audiences: string[];
  createdAt: Date;
};

export type ProductFilters = {
  department?: Department;
  category?: string;
  q?: string;
  colors?: string[];
  sizes?: string[];
  minCents?: number;
  maxCents?: number;
  sort?: "new" | "price-asc" | "price-desc";
};

const loadCards = cache(async (): Promise<ProductCard[]> => {
  const rows = await db
    .select({ product: products, categoryName: categories.name, department: categories.department })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(eq(products.active, true));
  const options = rows.length
    ? await db.select().from(variants).where(inArray(variants.productId, rows.map((row) => row.product.id)))
    : [];
  return rows.map(({ product, categoryName, department }) => {
    const own = options.filter((variant) => variant.productId === product.id);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0]!,
      hoverImage: product.images[1] ?? null,
      priceCents: Math.min(...own.map((variant) => variant.priceCents)),
      colors: [...new Set(own.map((variant) => variant.color))],
      sizes: [...new Set(own.map((variant) => variant.size))],
      soldOut: own.every((variant) => variant.stock === 0),
      featured: product.featured,
      category: product.categorySlug,
      categoryName,
      department: department as Department,
      audiences: product.audiences,
      createdAt: product.createdAt,
    };
  });
});

export async function listProducts(filters: ProductFilters = {}) {
  const needle = filters.q?.trim().toLowerCase();
  const cards = (await loadCards()).filter(
    (card) =>
      (!filters.department || filters.department === "leather" || card.audiences.includes(filters.department)) &&
      (!filters.category || card.category === filters.category) &&
      (!needle || `${card.name} ${card.categoryName} ${card.department} ${card.colors.join(" ")}`.toLowerCase().includes(needle)) &&
      (!filters.colors?.length || card.colors.some((color) => filters.colors!.includes(color))) &&
      (!filters.sizes?.length || card.sizes.some((size) => filters.sizes!.includes(size))) &&
      (filters.minCents === undefined || card.priceCents >= filters.minCents) &&
      (filters.maxCents === undefined || card.priceCents <= filters.maxCents),
  );
  const order = {
    new: (a: ProductCard, b: ProductCard) => b.createdAt.getTime() - a.createdAt.getTime(),
    "price-asc": (a: ProductCard, b: ProductCard) => a.priceCents - b.priceCents,
    "price-desc": (a: ProductCard, b: ProductCard) => b.priceCents - a.priceCents,
  };
  return cards.sort(order[filters.sort ?? "new"]);
}

export async function listFacets(department?: Department) {
  const cards = await listProducts({ department });
  return {
    colors: [...new Set(cards.flatMap((card) => card.colors))].sort(),
    sizes: [...new Set(cards.flatMap((card) => card.sizes))],
  };
}

export const listCategories = cache(async (department?: Department) => {
  const [rows, cards] = await Promise.all([db.select().from(categories).orderBy(asc(categories.position)), listProducts({ department })]);
  return rows.filter((row) => cards.some((card) => card.category === row.slug));
});

export const getProduct = cache(async (slug: string) => {
  const [row] = await db
    .select({ product: products, categoryName: categories.name, department: categories.department })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(and(eq(products.slug, slug), eq(products.active, true)));
  if (!row) return null;
  const options = await db.select().from(variants).where(eq(variants.productId, row.product.id)).orderBy(asc(variants.sku));
  const department = row.department === "leather" || row.product.audiences.includes(row.department) ? row.department : "leather";
  return { ...row.product, categoryName: row.categoryName, department: department as Department, variants: options };
});

export async function listRelated(productId: string, category: string, limit = 4) {
  const cards = await listProducts({ category });
  return cards.filter((card) => card.id !== productId).slice(0, limit);
}

export async function getReviews(productId: string) {
  const visible = and(eq(reviews.productId, productId), isNull(reviews.hiddenAt));
  const [summary] = await db
    .select({ average: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(visible);
  const items = await db
    .select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, reply: reviews.reply, repliedAt: reviews.repliedAt, createdAt: reviews.createdAt, author: users.name })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(visible)
    .orderBy(desc(reviews.createdAt));
  return { average: summary?.average ? Number(summary.average) : 0, total: summary?.total ?? 0, items: items.map((item) => ({ ...item, author: publicName(item.author) })) };
}

export async function getWishlist(ownerKey: string | null) {
  if (!ownerKey) return [];
  const saved = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.ownerKey, ownerKey))
    .orderBy(desc(wishlistItems.createdAt));
  const ids = saved.map((item) => item.productId);
  const cards = await listProducts();
  return ids.flatMap((id) => cards.find((card) => card.id === id) ?? []);
}
