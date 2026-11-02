import { studioSections } from "./studio-rows";
import { exactRow, length, row, withEverythingShown, type SheetSection } from "./rows";
import type { ProductSnapshot } from "./snapshot";

const dimensionsOf = ({ studioPreset: preset }: ProductSnapshot): SheetSection => ({
  title: "Outer dimensions",
  rows: preset
    ? [row("Width at the base", length(preset.form.width)), row("Height", length(preset.form.height)), row("Depth", length(preset.form.depth))]
    : [row("Dimensions", "Not stored for this product. Follow the size above and the product sample.")],
});

function recipeOf({ studioPreset: preset, color }: ProductSnapshot): SheetSection[] {
  if (!preset) return [{ title: "Model recipe", rows: [row("Model recipe", "None stored", "studioPreset")] }];
  const notice = row("Model recipe", `The rows below are the stored recipe for this model. The colour of this order is ${color}.`, "studioPreset");
  const sections = studioSections(preset).filter(({ title }) => title !== "Outer dimensions");
  return [{ title: "Model recipe", rows: [notice] }, ...sections.map((section) => ({ ...section, title: `Model, ${section.title.toLowerCase()}` }))];
}

export function productSections(snapshot: ProductSnapshot): SheetSection[] {
  const product: SheetSection = {
    title: "Product",
    rows: [
      exactRow("Product", snapshot.name, "name"),
      row("SKU", snapshot.sku, "sku"),
      row("Colour", snapshot.color, "color"),
      row("Size", snapshot.size, "size"),
      exactRow("Composition", snapshot.composition, "composition"),
      row("Category", snapshot.category.replaceAll("-", " "), "category"),
      exactRow("Description", snapshot.description, "description"),
      row("Product code", snapshot.slug, "slug", "productId"),
      row("Details frozen on", snapshot.frozenAt.slice(0, 10), "frozenAt", "frozenLate"),
      row("Photos held", String(snapshot.images.length), "images"),
    ],
  };
  return withEverythingShown(snapshot, [product, dimensionsOf(snapshot), ...recipeOf(snapshot)]);
}
