import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Button, inputClass } from "@/components/ui";
import { listCategories, listProducts } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

async function search(query: string) {
  const words = query.split(/\s+/).filter(Boolean);
  const [first, ...others] = await Promise.all(words.map((q) => listProducts({ q })));
  if (!first) return [];
  return first.filter((card) => others.every((list) => list.some((other) => other.id === card.id)));
}

async function Suggestions() {
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  const featured = products.filter((card) => card.featured).slice(0, 4);
  return (
    <div className="mt-10 grid gap-12">
      <nav aria-label="Suggestions" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {categories.map((category) => (
          <Link key={category.slug} href={categoryPath("leather", category.slug)} className="underline underline-offset-4 hover:opacity-60">
            {category.name}
          </Link>
        ))}
      </nav>
      <section aria-labelledby="popular">
        <h2 id="popular" className="mb-6 font-display text-3xl">Worth a look</h2>
        <div className="grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-4">
          {featured.map((card) => (
            <ProductCard key={card.id} product={card} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const results = await search(query);

  return (
    <div className="px-4 pt-24 md:px-8">
      <h1 className="font-display text-4xl leading-[1.05] md:text-6xl">Search</h1>
      <Form action="/search" role="search" className="mt-8 flex max-w-2xl gap-2">
        <input type="search" name="q" defaultValue={query} aria-label="Search the collection" placeholder="Tote, cognac, belt" className={inputClass} />
        <Button type="submit">Search</Button>
      </Form>

      {query ? (
        <p aria-live="polite" className="mt-6 text-[13px] text-muted">
          {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
        </p>
      ) : null}

      {results.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {results.map((card) => (
            <ProductCard key={card.id} product={card} />
          ))}
        </div>
      ) : (
        <Suggestions />
      )}
    </div>
  );
}
