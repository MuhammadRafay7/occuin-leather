import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { DEPARTMENTS, listCategories, listProducts, type Department } from "@/lib/server/catalog";
import { absoluteUrl } from "@/lib/seo";
import { categoryPath } from "@/lib/server/shop";

const CONTENT_UPDATED = new Date("2026-11-01");
const PAGES = ["/studio", "/studio/create", "/find-your-bag", "/about", "/care", "/shipping-returns", "/size-guide", "/faq", "/contact", "/privacy", "/terms"];

const latest = (cards: { createdAt: Date }[]) => new Date(Math.max(...cards.map((card) => card.createdAt.getTime())));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const departments = Object.keys(DEPARTMENTS) as Department[];
  const [products, shop] = await Promise.all([
    listProducts(),
    Promise.all(
      departments.map(async (department) => {
        const [cards, categories] = await Promise.all([listProducts({ department }), listCategories(department)]);
        const sections = categories.map((category) => ({
          url: absoluteUrl(categoryPath(department, category.slug)),
          lastModified: latest(cards.filter((card) => card.category === category.slug)),
        }));
        return [{ url: absoluteUrl(`/shop/${department}`), lastModified: latest(cards) }, ...sections];
      }),
    ),
  ]);
  return [
    { url: absoluteUrl("/"), lastModified: latest(products) },
    ...PAGES.map((path) => ({ url: absoluteUrl(path), lastModified: CONTENT_UPDATED })),
    ...shop.flat(),
    ...products.map((product) => ({ url: absoluteUrl(`/product/${product.slug}`), lastModified: product.createdAt })),
  ];
}
