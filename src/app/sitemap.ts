import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { DEPARTMENTS, listCategories, listProducts } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const PAGES = ["", "/studio", "/about", "/care", "/shipping-returns", "/size-guide", "/faq", "/contact", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  return [
    ...PAGES.map((path) => ({ url: `${APP_URL}${path}` })),
    ...Object.keys(DEPARTMENTS).map((slug) => ({ url: `${APP_URL}/shop/${slug}` })),
    ...categories.map((category) => ({ url: `${APP_URL}${categoryPath("leather", category.slug)}` })),
    ...products.map((product) => ({ url: `${APP_URL}/product/${product.slug}`, lastModified: product.createdAt })),
  ];
}
