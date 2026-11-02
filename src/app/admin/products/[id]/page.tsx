import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { AdminTitle, buttonClass, Notice, StatusDot } from "../../_components/ui";
import { param, variantToInput, type SearchParams } from "../../_lib/format";
import { listAllCategories, listMediaChoices } from "../../_lib/queries-catalog";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, parsed.data));
  if (!product) notFound();
  const [categories, library, variants] = await Promise.all([
    listAllCategories(),
    listMediaChoices(),
    db.select().from(schema.variants).where(eq(schema.variants.productId, product.id)).orderBy(asc(schema.variants.sku)),
  ]);
  const created = param(await searchParams, "created") === "1";

  return (
    <>
      <AdminTitle
        back={{ href: "/admin/products", label: "Products" }}
        meta={<StatusDot tone={product.active ? "success" : "muted"}>{product.active ? "In the store" : "Hidden"}</StatusDot>}
        sub={product.active ? "Make your changes, then save." : "Customers cannot see this product yet."}
        action={product.active ? <Link href={`/product/${product.slug}`} target="_blank" className={buttonClass}>View in store</Link> : undefined}
      >
        {product.name}
      </AdminTitle>
      {created ? <div className="mb-3"><Notice result={{ ok: true, message: "Product created." }} /></div> : null}
      <ProductForm
        key={product.id}
        categories={categories}
        library={library}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          composition: product.composition,
          categorySlug: product.categorySlug,
          images: product.images.join("\n"),
          audiences: product.audiences,
          featured: product.featured,
          active: product.active,
          variants: variants.map(variantToInput),
        }}
      />
    </>
  );
}
