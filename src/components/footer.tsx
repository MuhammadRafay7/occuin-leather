import Link from "next/link";
import { BRAND } from "@/lib/format";
import { CookieNotice } from "./cookie-notice";
import { NewsletterForm } from "./newsletter-form";

const COLUMNS = [
  { title: "Shop", links: [["Women", "/shop/women"], ["Men", "/shop/men"], ["Laptop bags", "/shop/leather/laptop-bags"], ["Totes", "/shop/leather/totes"], ["Wallets and cards", "/shop/leather/wallets"], ["Design your own", "/studio"]] },
  { title: "Help", links: [["Contact", "/contact"], ["Track an order", "/track"], ["Shipping and returns", "/shipping-returns"], ["Size guide", "/size-guide"], ["Questions", "/faq"]] },
  { title: "House", links: [["About", "/about"], ["Leather care", "/care"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line px-4 py-14 md:px-8">
      <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-8">
          <p className="font-display text-3xl tracking-[0.16em]">{BRAND.name}</p>
          <NewsletterForm />
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="grid content-start gap-2 text-sm">
            <p className="mb-1 text-muted">{column.title}</p>
            {column.links.map(([label, href]) => (
              <Link key={href} href={href!} className="hover:opacity-60">{label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <p className="mt-14 text-xs text-muted">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
      <p aria-hidden="true" className="-mx-4 -mb-14 mt-8 select-none overflow-hidden whitespace-nowrap text-center font-display text-[22.5vw] leading-[0.82] text-invert-bg md:-mx-8">{BRAND.name}</p>
      <CookieNotice />
    </footer>
  );
}
