"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/content", label: "Overview" },
  { href: "/admin/content/homepage", label: "Homepage" },
  { href: "/admin/content/pages", label: "Pages" },
  { href: "/admin/content/navigation", label: "Menus" },
  { href: "/admin/content/seo", label: "Search listing" },
  { href: "/admin/content/pricing", label: "Prices" },
  { href: "/admin/content/redirects", label: "Old links" },
];

export function ContentTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Content sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line pb-px text-sm">
      {TABS.map((tab) => {
        const current = tab.href === "/admin/content" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={current ? "page" : undefined} className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-2 ${current ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
