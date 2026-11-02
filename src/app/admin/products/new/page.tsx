import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle } from "../../_components/ui";
import { listAllCategories, listMediaChoices } from "../../_lib/queries-catalog";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

const BLANK_VARIANT = { color: "", size: "", sku: "", price: "", stock: "0" };

export default async function NewProduct() {
  await requireAdmin();
  const [categories, library] = await Promise.all([listAllCategories(), listMediaChoices()]);
  return (
    <>
      <AdminTitle back={{ href: "/admin/products", label: "Products" }} sub="Add photos, a name, a price and how many you have.">New product</AdminTitle>
      <ProductForm
        categories={categories}
        library={library}
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
