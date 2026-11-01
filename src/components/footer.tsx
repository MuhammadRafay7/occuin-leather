import Link from "next/link";
import { BRAND } from "@/lib/format";
import { LogoMark } from "./logo";
import { CookieNotice } from "./cookie-notice";
import { NewsletterForm } from "./newsletter-form";

const COLUMNS = [
  { title: "Shop", links: [["Women", "/shop/women"], ["Men", "/shop/men"], ["Laptop bags", "/shop/leather/laptop-bags"], ["Totes", "/shop/leather/totes"], ["Wallets and cards", "/shop/leather/wallets"], ["Customise", "/studio"], ["Create your own", "/studio/create"]] },
  { title: "Help", links: [["Contact", "/contact"], ["Track an order", "/track"], ["Shipping and returns", "/shipping-returns"], ["Size guide", "/size-guide"], ["Questions", "/faq"]] },
  { title: "House", links: [["About", "/about"], ["Leather care", "/care"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

export function Footer() {
  return (
    <footer className="px-page mt-16 border-t border-line py-14 md:mt-24">
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-10">
        <div className="col-span-2 grid content-start gap-8 md:col-span-1">
          <p className="flex items-center gap-2 font-display text-3xl tracking-[0.16em]"><LogoMark className="size-9 shrink-0" />{BRAND.name}</p>
          <NewsletterForm />
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="grid content-start text-sm lg:gap-2">
            <p className="text-muted lg:mb-1">{column.title}</p>
            {column.links.map(([label, href]) => (
              <Link key={href} href={href!} className="flex min-h-11 items-center hover:opacity-60 lg:block lg:min-h-0">{label}</Link>
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
