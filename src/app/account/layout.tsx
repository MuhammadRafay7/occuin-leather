import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PendingTextButton } from "@/components/pending-button";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: { default: "Account", template: "%s | OCCUIN" }, robots: { index: false } };

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
  { href: "/studio", label: "Saved designs" },
  { href: "/wishlist", label: "Wishlist" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1280px] gap-10 px-4 pb-24 pt-24 md:px-8 lg:grid-cols-[200px_1fr] lg:gap-16">
      <nav aria-label="Account" className="flex flex-wrap items-center gap-x-5 gap-y-1 self-start text-sm lg:grid lg:gap-1">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="py-2 hover:opacity-60">{link.label}</Link>
        ))}
        <form action={signOut}>
          <PendingTextButton pendingLabel="Signing out">Sign out</PendingTextButton>
        </form>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
