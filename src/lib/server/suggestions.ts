import { listProducts, type ProductCard } from "./catalog";
import type { CartLine } from "./cart";

export type SuggestedCard = Pick<ProductCard, "slug" | "name" | "image" | "priceCents" | "categoryName" | "sizes" | "soldOut">;

const LIMIT = 3;

const slugOf = (line: CartLine) => (line.kind === "product" ? line.href.replace(/^\/product\//, "") : null);

export const toSuggestion = ({ slug, name, image, priceCents, categoryName, sizes, soldOut }: ProductCard): SuggestedCard => ({ slug, name, image, priceCents, categoryName, sizes, soldOut });

export async function suggestFor(lines: CartLine[]): Promise<SuggestedCard[]> {
  if (!lines.length) return [];
  const cards = await listProducts();
  const inBag = new Set(lines.map(slugOf).filter(Boolean));
  const owned = cards.filter((card) => inBag.has(card.slug));
  const categories = new Set(owned.map((card) => card.category));
  const audiences = new Set(owned.flatMap((card) => card.audiences));
  const open = cards.filter((card) => !inBag.has(card.slug) && !card.soldOut);
  const score = (card: ProductCard) =>
    (categories.has(card.category) ? 0 : 4) + (audiences.size === 0 || card.audiences.some((audience) => audiences.has(audience)) ? 2 : 0) + (card.featured ? 1 : 0);
  return open
    .map((card, index) => ({ card, index, score: score(card) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, LIMIT)
    .map(({ card }) => toSuggestion(card));
}
