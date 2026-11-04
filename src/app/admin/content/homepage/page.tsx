import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { ownsStudioModel } from "@/lib/server/catalog";
import { CONTENT, getContent } from "@/lib/server/content";
import { db, schema } from "@/lib/server/db";
import { PRESETS } from "@/lib/studio/presets";
import { COLORS } from "@/lib/studio/spec";
import { AdminTitle, Empty } from "../../_components/ui";
import { listMediaChoices } from "../../_lib/queries-catalog";
import { HomeEditor } from "./home-form";

export const metadata: Metadata = { title: "Homepage" };

export default async function ContentHomepage() {
  await requireAdmin();
  const [home, media, studioProducts] = await Promise.all([
    getContent("home"),
    listMediaChoices(),
    db.select({ slug: schema.products.slug, name: schema.products.name }).from(schema.products).where(ownsStudioModel).orderBy(schema.products.name),
  ]);
  const presets = Object.keys(PRESETS).map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));
  const leathers = Object.entries(COLORS).map(([value, color]) => ({ value, label: color.name }));
  const products = studioProducts.map((product) => ({ value: product.slug, label: product.name }));
  return (
    <>
      <AdminTitle sub="Change the words and pictures on your home page. Saving updates the site straight away.">Homepage</AdminTitle>
      {products.length ? null : <div className="mb-4"><Empty title="No products can open in the studio" body="The bags to try at the top of the page need one. Add a studio product first." /></div>}
      <HomeEditor initial={home} fallback={CONTENT.home.fallback} media={media} presets={presets} leathers={leathers} products={products} />
    </>
  );
}
