import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
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
import { listCustomisable } from "./customisable";
import { FilterLinks } from "./filter-links";
import { GlassCard } from "./glass-card";
import { arrangeCards } from "./rhythm";
import { ScrollRail } from "./scroll-rail";
import { ShopDock } from "./shop-dock";
import { ShopStage, SHOP_GRID } from "./shop-stage";

type Props = {
  path: string;
  title: string;
  params: RawParams;
  department: Department;
  category?: string;
};

const DEPARTMENT_LINKS: { department: Department; label: string }[] = [
  { department: "women", label: "Women" },
  { department: "men", label: "Men" },
  { department: "leather", label: "All" },
];

const DESCRIPTIONS: Record<Department, string> = {
  women: "Bags and wallets, made by hand to order in Pakistan.",
  men: "Laptop bags and wallets, made by hand to order.",
  leather: "Every piece made by hand to order in Pakistan.",
};
const CATEGORY_DESCRIPTION = "Made by hand to order in Pakistan, shipped worldwide.";

const PILL_FOCUS = "focus-visible:outline-[#f4efe6]";
const SEGMENT = `flex h-11 items-center rounded-full px-4 text-[13px] transition-colors [@media(hover:hover)]:h-9 ${PILL_FOCUS}`;
const SECTION = `flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[13px] transition-colors [@media(hover:hover)]:h-9 ${PILL_FOCUS}`;
const CHOSEN = "border-[#f4efe6] bg-[#f4efe6] text-[#14201c]";
const RESTING = "border-white/18 text-[#f4efe6] hover:border-white/45 hover:bg-white/10";
const PAGE_LINK = `flex h-11 items-center rounded-full border border-white/25 px-5 text-[13px] text-[#f4efe6] transition-colors hover:bg-white/10 ${PILL_FOCUS}`;

async function sectionLinks(department: Department) {
  const categories = await listCategories(department);
  return [
    { href: `/shop/${department}`, label: "All" },
    ...categories.map((item) => ({ href: categoryPath(department, item.slug), label: item.name })),
  ];
}

function CreateYourOwn() {
  return (
    <Link href="/studio/create" className={`group mx-auto flex h-11 w-fit items-center gap-2 rounded-full px-4 text-[13px] text-[#f4efe6] ${PILL_FOCUS}`}>
      <span className="text-[#f4efe6]/78">Not quite it?</span>
      <span className="underline underline-offset-4">Create your own</span>
      <ArrowRight size={14} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

export async function ShopView({ path, title, params, department, category }: Props) {
  const state = parseShopState(params);
  const [scope, results, links, customisable] = await Promise.all([
    listProducts({ department, category }),
    listProducts({ department, category, ...toFilters(state) }),
    sectionLinks(department),
    listCustomisable(),
  ]);

  const colors = [...new Set(scope.flatMap((card) => card.colors))].sort();
  const sizes = [...new Set(scope.flatMap((card) => card.sizes))].sort(compareSizes);
  const pages = Math.max(Math.ceil(results.length / PAGE_SIZE), 1);
  const page = Math.min(state.page, pages);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const placements = arrangeCards(visible.length);

  return (
    <ShopStage>
      <header className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-8">
        <div className="min-w-0">
          <h1 className="font-display text-[38px] leading-[1.06] text-[#f4efe6] md:text-[52px]">{title}</h1>
          <p className="truncate text-[13px] leading-[1.5] text-[#f4efe6]/80 md:text-sm">{category ? CATEGORY_DESCRIPTION : DESCRIPTIONS[department]}</p>
        </div>

        <div className="grid min-w-0 gap-1 xl:justify-items-end xl:gap-2">
          <nav aria-label="Departments" className="flex w-fit gap-0.5 rounded-full border border-white/15 bg-white/8 p-0.5 [@media(hover:hover)]:p-[3px]">
            {DEPARTMENT_LINKS.map((link) => (
              <Link key={link.department} href={`/shop/${link.department}`} aria-current={link.department === department ? "page" : undefined} className={`${SEGMENT} ${link.department === department ? "bg-[#f4efe6] text-[#14201c]" : "text-[#f4efe6] hover:bg-white/10"}`}>
                {link.label}
              </Link>
            ))}
          </nav>

          <ScrollRail aria-label="Sections" className="-mx-4 gap-1.5! px-4 md:-mx-8 md:px-8 xl:mx-0 xl:flex-wrap xl:justify-end xl:px-0">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={link.href === path ? "page" : undefined} className={`${SECTION} ${link.href === path ? CHOSEN : RESTING}`}>
                {link.label}
              </Link>
            ))}
          </ScrollRail>
        </div>
      </header>

      <div data-shop-grid className="mt-3 scroll-mt-24 md:mt-5">
        {visible.length ? (
          <div className={SHOP_GRID}>
            {visible.map((product, index) => (
              <GlassCard key={product.id} product={product} placement={placements[index]!} customisable={customisable.has(product.id)} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="mx-auto grid max-w-[560px] justify-items-center gap-3 rounded-[28px] border border-white/15 bg-white/8 px-6 py-12 text-center md:mt-10 md:py-16">
            <h2 className="font-display text-[32px] leading-tight text-[#f4efe6]">Nothing matches those filters</h2>
            <p className="text-sm text-[#f4efe6]/80">Remove a filter or widen the price range to see more.</p>
            <Link href={shopHref(path, state, { colors: [], sizes: [], min: undefined, max: undefined })} className={`mt-2 flex h-12 items-center rounded-full bg-[#f4efe6] px-7 text-sm font-medium text-[#14201c] transition active:scale-[0.97] ${PILL_FOCUS}`}>
              Clear filters
            </Link>
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[13px] text-[#f4efe6] md:mt-10">
            {page > 1 ? <Link rel="prev" href={shopHref(path, state, { page: page - 1 })} className={`${PAGE_LINK} justify-self-start`}>Previous</Link> : <span />}
            <p className="tabular-nums text-[#f4efe6]/80">Page {page} of {pages}</p>
            {page < pages ? <Link rel="next" href={shopHref(path, state, { page: page + 1 })} className={`${PAGE_LINK} col-start-3 justify-self-end`}>Next</Link> : null}
          </nav>
        ) : null}

        {page === pages ? (
          <div className="mt-6 md:mt-8">
            <CreateYourOwn />
          </div>
        ) : null}
      </div>

      <ShopDock path={path} state={state} colors={colors} sizes={sizes} resultCount={results.length} />
      <noscript>
        <FilterLinks path={path} state={state} colors={colors} sizes={sizes} />
      </noscript>
    </ShopStage>
  );
}
