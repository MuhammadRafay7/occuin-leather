import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listContentStatus, type ContentKey } from "@/lib/server/content";
import { AdminTitle, linkClass, Tag } from "../_components/ui";
import { dateTime } from "../_lib/format";
import { describeStatus, pageKey, PAGE_SLUGS } from "./_components/page-list";

export const metadata: Metadata = { title: "Content" };

const SECTIONS: { href: string; title: string; body: string; keys: ContentKey[] }[] = [
  { href: "/admin/content/homepage", title: "Homepage", body: "The words and pictures on your home page.", keys: ["home"] },
  { href: "/admin/content/pages", title: "Pages", body: "About, Questions, Care, Shipping, Size guide, Contact, Terms and Privacy.", keys: PAGE_SLUGS.map(pageKey) },
  { href: "/admin/content/navigation", title: "Menus", body: "The links at the top and bottom of your site.", keys: ["nav"] },
  { href: "/admin/content/seo", title: "Search listing", body: "How your site looks in Google and when someone shares a link.", keys: ["seo"] },
  { href: "/admin/content/pricing", title: "Prices", body: "Studio prices, delivery times and custom order deposits.", keys: ["pricing", "delivery", "bespoke"] },
  { href: "/admin/content/redirects", title: "Old links", body: "Send people from an old page to a new one.", keys: ["redirects"] },
];

export default async function ContentOverview() {
  await requireAdmin();
  const rows = await listContentStatus();
  return (
    <>
      <AdminTitle sub="Change the words, pictures, menus and prices on your site. Pick what you want to change.">Content</AdminTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((section) => {
          const statuses = section.keys.map((key) => describeStatus(key, rows));
          const changed = statuses.filter((status) => status.row);
          const latest = changed.map((status) => status.row!).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
          return (
            <li key={section.href} className="grid content-start gap-2 border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <Link href={section.href} className={`font-medium ${linkClass}`}>{section.title}</Link>
                <Tag tone={changed.length ? "plain" : "muted"}>{changed.length ? `${changed.length} of ${statuses.length} changed` : "Original"}</Tag>
              </div>
              <p className="text-sm text-muted">{section.body}</p>
              {latest ? <p className="text-xs text-muted">Last saved {dateTime(latest.updatedAt)}{latest.email ? ` by ${latest.email}` : ""}</p> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
