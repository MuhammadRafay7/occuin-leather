import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PendingTextButton } from "@/components/pending-button";
import { ScrollRail } from "@/components/shop/scroll-rail";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: { default: "Account", template: "%s | OCCUIN" }, robots: { index: false } };

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/bespoke", label: "Bespoke" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
  { href: "/studio", label: "Saved designs" },
  { href: "/wishlist", label: "Wishlist" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="px-page mx-auto grid max-w-[1280px] gap-6 pb-24 pt-header lg:grid-cols-[200px_1fr] lg:gap-16">
      <ScrollRail aria-label="Account" className="-mx-4 min-w-0 items-center gap-x-5 self-start px-4 text-sm md:mx-0 md:px-0 lg:grid lg:gap-1">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="flex min-h-11 shrink-0 items-center whitespace-nowrap hover:opacity-60 lg:block lg:min-h-0 lg:py-2">{link.label}</Link>
        ))}
        <form action={signOut} className="shrink-0">
          <PendingTextButton pendingLabel="Signing out">Sign out</PendingTextButton>
        </form>
      </ScrollRail>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
