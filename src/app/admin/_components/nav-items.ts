import type { Icon } from "@phosphor-icons/react";
import { ChartBar, GearSix, Layout, Package, SquaresFour, Tray, Users } from "@phosphor-icons/react/dist/ssr";

export type NavCounts = { ordersWaiting: number; messagesOpen: number; bespokeNew: number };

export type NavLink = { href: string; label: string; badge?: keyof NavCounts; badgeLabel?: string; exact?: boolean };

export type NavGroup = { title: string; icon: Icon; href?: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  { title: "Dashboard", icon: SquaresFour, href: "/admin", links: [] },
  {
    title: "Sales",
    icon: Tray,
    links: [
      { href: "/admin/orders", label: "Orders", badge: "ordersWaiting", badgeLabel: "need action" },
      { href: "/admin/carts", label: "Unfinished carts" },
      { href: "/admin/bespoke", label: "Bespoke", badge: "bespokeNew", badgeLabel: "new" },
      { href: "/admin/promos", label: "Discount codes" },
    ],
  },
  {
    title: "Products",
    icon: Package,
    links: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/inventory", label: "Stock" },
      { href: "/admin/media", label: "Photos" },
      { href: "/admin/reviews", label: "Reviews" },
    ],
  },
  {
    title: "Customers",
    icon: Users,
    links: [
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/messages", label: "Messages", badge: "messagesOpen", badgeLabel: "open" },
      { href: "/admin/newsletter", label: "Newsletter" },
    ],
  },
  {
    title: "Website",
    icon: Layout,
    links: [
      { href: "/admin/content", label: "Overview", exact: true },
      { href: "/admin/content/homepage", label: "Homepage" },
      { href: "/admin/content/pages", label: "Pages" },
      { href: "/admin/content/navigation", label: "Menus" },
      { href: "/admin/content/seo", label: "Search listing" },
      { href: "/admin/content/pricing", label: "Prices" },
      { href: "/admin/content/redirects", label: "Old links" },
    ],
  },
  {
    title: "Reports",
    icon: ChartBar,
    links: [
      { href: "/admin/reports", label: "Sales reports" },
      { href: "/admin/activity", label: "Change history" },
    ],
  },
  {
    title: "Settings",
    icon: GearSix,
    links: [
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/system", label: "Site status" },
    ],
  },
];

export const isCurrent = (pathname: string, link: Pick<NavLink, "href" | "exact">) =>
  link.exact || link.href === "/admin" ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);

export function breadcrumbChain(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") return [{ label: "Dashboard" }];
  for (const group of NAV_GROUPS) {
    const link = group.links.find((item) => isCurrent(pathname, item));
    if (link) return group.title === link.label ? [{ label: link.label, href: link.href }] : [{ label: group.title }, { label: link.label, href: link.href }];
  }
  return pathname === "/admin/search" ? [{ label: "Search" }] : [];
}

export const COOKIES = { theme: "adm_theme", rail: "adm_rail" } as const;

export function remember(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/admin; max-age=31536000; samesite=lax`;
}
