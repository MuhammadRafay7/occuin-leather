import type { Metadata } from "next";
import { fillTokens } from "@/lib/content/rich-text";
import { categoryMeta, META, productMeta, type SeoContext } from "@/lib/seo";
import { requireAdmin } from "@/lib/server/auth";
import { DEPARTMENTS, getProduct, listCategories, listProducts, type Department } from "@/lib/server/catalog";
import { CONTENT, getAllTokens, getContent, seoImage } from "@/lib/server/content";
import { categoryPath } from "@/lib/server/shop";
import { AdminTitle } from "../../_components/ui";
import { listMediaChoices } from "../../_lib/queries-catalog";
import { SeoEditor, type SeoRow } from "./seo-form";

export const metadata: Metadata = { title: "Search listing" };

const flatten = (meta: { title?: unknown; description?: unknown }) => ({
  title: (meta.title as { absolute: string }).absolute,
  description: String(meta.description),
});

async function rowsFor(context: SeoContext) {
  const rows = new Map<string, SeoRow>();
  for (const [path, entry] of Object.entries(META)) {
    rows.set(path, { path, group: "Pages", title: fillTokens(entry.title, context.tokens), description: fillTokens(entry.description, context.tokens) });
  }
  for (const department of Object.keys(DEPARTMENTS) as Department[]) {
    for (const category of await listCategories(department)) {
      const path = categoryPath(department, category.slug);
      if (!rows.has(path)) rows.set(path, { path, group: "Categories", ...flatten(categoryMeta(path, category.name, context)) });
    }
  }
  const cards = await listProducts();
  const products = await Promise.all(cards.map((card) => getProduct(card.slug)));
  for (const product of products) {
    if (!product) continue;
    const path = `/product/${product.slug}`;
    rows.set(path, { path, group: "Products", ...flatten(productMeta(product, context)) });
  }
  return [...rows.values()];
}

export default async function ContentSeo() {
  await requireAdmin();
  const [seo, tokens, image, media] = await Promise.all([getContent("seo"), getAllTokens(), seoImage(), listMediaChoices()]);
  const rows = await rowsFor({ pages: {}, image, tokens });
  return (
    <>
      <AdminTitle sub="How your site looks in Google and when someone shares a link. Most people only change a few pages.">Search listing</AdminTitle>
      <SeoEditor initial={seo} fallback={CONTENT.seo.fallback} rows={rows} tokens={tokens} media={media} />
    </>
  );
}
