import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listCategories } from "@/lib/server/catalog";
import { AdminTitle, linkClass } from "../../_components/ui";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

const BLANK_VARIANT = { color: "", size: "", sku: "", price: "", stock: "0" };

export default async function NewProduct() {
  await requireAdmin();
  const categories = await listCategories();
  return (
    <>
      <AdminTitle action={<Link href="/admin/products" className={`text-sm ${linkClass}`}>All products</Link>}>New product</AdminTitle>
      <ProductForm
        categories={categories}
        initial={{
          name: "",
          slug: "",
          description: "",
          composition: "",
          categorySlug: "",
          images: "",
          audiences: ["women", "men"],
          featured: false,
          active: true,
          variants: [BLANK_VARIANT],
        }}
      />
    </>
  );
}
