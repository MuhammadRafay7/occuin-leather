"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/promos", label: "Promo codes" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/newsletter", label: "Newsletter" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="md:sticky md:top-24 md:self-start">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line pb-3 text-sm md:grid md:gap-1 md:border-b-0 md:pb-0">
        {LINKS.map(({ href, label }) => {
          const current = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={current ? "font-medium text-fg underline underline-offset-4" : "text-muted hover:text-fg"}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
