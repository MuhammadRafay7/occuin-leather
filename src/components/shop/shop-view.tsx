import Link from "next/link";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import {
  listCategories,
  listProducts,
  type Department,
} from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";
import {
  PAGE_SIZE,
  compareSizes,
  parseShopState,
  shopHref,
  toFilters,
  type RawParams,
} from "@/lib/shop-params";
import { DensityGrid } from "./density";
import { FilterLinks } from "./filter-links";
import { ShopDock } from "./shop-dock";

type Props = {
  path: string;
  title: string;
  params: RawParams;
  department: Department;
  category?: string;
};

const CARD_SIZES = "(min-width: 768px) 34vw, 50vw";
const LINK = "shrink-0 whitespace-nowrap py-1 text-[13px] hover:opacity-60";

const DEPARTMENT_LINKS: { department: Department; label: string }[] = [
  { department: "women", label: "Women" },
  { department: "men", label: "Men" },
  { department: "leather", label: "All" },
];

async function sectionLinks(department: Department) {
  const categories = await listCategories(department);
  return [
    { href: `/shop/${department}`, label: "All" },
    ...categories.map((item) => ({ href: categoryPath(department, item.slug), label: item.name })),
  ];
}

export async function ShopView({ path, title, params, department, category }: Props) {
  const state = parseShopState(params);
  const [scope, results, links] = await Promise.all([
    listProducts({ department, category }),
    listProducts({ department, category, ...toFilters(state) }),
    sectionLinks(department),
  ]);

  const colors = [...new Set(scope.flatMap((card) => card.colors))].sort();
  const sizes = [...new Set(scope.flatMap((card) => card.sizes))].sort(compareSizes);
  const pages = Math.max(Math.ceil(results.length / PAGE_SIZE), 1);
  const page = Math.min(state.page, pages);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-4 pb-24 pt-24 md:px-8">
      <nav aria-label="Departments" className="mb-4 flex gap-6">
        {DEPARTMENT_LINKS.map((link) => (
          <Link key={link.department} href={`/shop/${link.department}`} aria-current={link.department === department ? "page" : undefined} className={`${LINK} ${link.department === department ? "underline underline-offset-4" : "text-muted"}`}>
            {link.label}
          </Link>
        ))}
      </nav>
      <PageTitle>{title}</PageTitle>

      <nav aria-label="Sections" className="-mx-4 -mt-6 flex gap-6 overflow-x-auto px-4 pb-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={link.href === path ? "page" : undefined} className={`${LINK} ${link.href === path ? "underline underline-offset-4" : ""}`}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div data-shop-grid className="mt-6 scroll-mt-24">
          {visible.length ? (
            <DensityGrid>
              {visible.map((product, index) => (
                <ProductCard key={product.id} product={product} sizes={CARD_SIZES} priority={index < 4} />
              ))}
            </DensityGrid>
          ) : (
            <EmptyState
              title="Nothing matches those filters"
              body="Remove a filter or widen the price range to see more."
              action={
                <LinkButton look="outline" href={shopHref(path, state, { colors: [], sizes: [], min: undefined, max: undefined })}>
                  Clear filters
                </LinkButton>
              }
            />
          )}

          {pages > 1 ? (
            <nav aria-label="Pages" className="mt-14 flex items-center justify-between text-[13px]">
              {page > 1 ? (
                <Link rel="prev" href={shopHref(path, state, { page: page - 1 })} className="underline underline-offset-4 hover:opacity-60">Previous</Link>
              ) : (
                <span />
              )}
              <p className="text-muted">Page {page} of {pages}</p>
              {page < pages ? (
                <Link rel="next" href={shopHref(path, state, { page: page + 1 })} className="underline underline-offset-4 hover:opacity-60">Next</Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
      </div>

      <ShopDock path={path} state={state} colors={colors} sizes={sizes} resultCount={results.length} />
      <noscript>
        <FilterLinks path={path} state={state} colors={colors} sizes={sizes} />
      </noscript>
    </div>
  );
}
