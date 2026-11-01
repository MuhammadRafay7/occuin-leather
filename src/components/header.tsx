import Link from "next/link";
import { getOwnerKey, getUser } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { listCategories } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";
import { BRAND } from "@/lib/format";
import { BagDrawer } from "./bag-drawer";
import { HeaderMenu } from "./header-menu";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";

const NAV = [
  { href: "/shop/women", label: "Women" },
  { href: "/shop/men", label: "Men" },
  { href: "/shop/leather/laptop-bags", label: "Laptop bags" },
  { href: "/studio", label: "Customise" },
  { href: "/studio/create", label: "Create your own" },
];

export async function Header() {
  const [user, ownerKey] = await Promise.all([getUser(), getOwnerKey()]);
  const [{ count }, women, men] = await Promise.all([getCart(ownerKey), listCategories("women"), listCategories("men")]);
  const menus = {
    "/shop/women": women.map((item) => ({ href: categoryPath("women", item.slug), label: item.name })),
    "/shop/men": men.map((item) => ({ href: categoryPath("men", item.slug), label: item.name })),
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))] pt-[max(8px,env(safe-area-inset-top))] md:pl-[max(16px,env(safe-area-inset-left))] md:pr-[max(16px,env(safe-area-inset-right))] md:pt-[max(12px,env(safe-area-inset-top))]">
      <div className="glass grid h-14 grid-cols-[1fr_auto_1fr] items-center rounded-full px-5 md:px-4">
        <div className="flex items-center">
          <HeaderMenu links={NAV} signedIn={Boolean(user)} isAdmin={user?.role === "admin"} />
          <NavLinks links={NAV} menus={menus} />
        </div>
        <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center gap-1.5 flex h-11 items-center font-display text-[24px] leading-none tracking-[0.14em] text-invert-bg md:text-[28px]">
          <LogoMark className="size-8 shrink-0" />
          {BRAND.name}
        </Link>
        <nav aria-label="Account" className="flex items-center justify-end gap-5 pr-2 text-[13px] md:gap-6">
          <Link href="/search" className="hidden h-11 items-center hover:opacity-60 md:flex">Search</Link>
          <Link href={user ? "/account" : "/login"} className="hidden h-11 items-center hover:opacity-60 md:flex">{user ? "Account" : "Sign in"}</Link>
          <Link href="/wishlist" className="hidden h-11 items-center hover:opacity-60 md:flex">Saved</Link>
          <BagDrawer count={count} />
        </nav>
      </div>
    </header>
  );
}
