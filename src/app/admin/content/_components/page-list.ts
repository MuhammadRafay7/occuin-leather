import { CONTENT, type ContentKey } from "@/lib/server/content";

export const PAGE_SLUGS = ["about", "faq", "care", "shipping-returns", "size-guide", "contact", "terms", "privacy"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export const pageKey = (slug: PageSlug) => `page.${slug}` as const;
export const isPageSlug = (value: string): value is PageSlug => (PAGE_SLUGS as readonly string[]).includes(value);

export const describeStatus = (key: ContentKey, rows: { key: string; updatedAt: Date; email: string | null }[]) => {
  const row = rows.find((item) => item.key === key);
  return { label: CONTENT[key].label, preview: CONTENT[key].preview, row };
};
