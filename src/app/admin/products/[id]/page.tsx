import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { listCategories } from "@/lib/server/catalog";
import { db, schema } from "@/lib/server/db";
import { AdminTitle, linkClass, Notice } from "../../_components/ui";
import { param, variantToInput, type SearchParams } from "../../_lib/format";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, parsed.data));
  if (!product) notFound();
  const [categories, variants] = await Promise.all([
    listCategories(),
    db.select().from(schema.variants).where(eq(schema.variants.productId, product.id)).orderBy(asc(schema.variants.sku)),
  ]);
  const created = param(await searchParams, "created") === "1";

  return (
    <>
      <AdminTitle
        sub={product.active ? <Link href={`/product/${product.slug}`} className={linkClass}>View in store</Link> : "Inactive, hidden from the store"}
        action={<Link href="/admin/products" className={`text-sm ${linkClass}`}>All products</Link>}
      >
        {product.name}
      </AdminTitle>
      {created ? <div className="mb-4"><Notice result={{ ok: true, message: "Product created." }} /></div> : null}
      <ProductForm
        key={product.id}
        categories={categories}
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
