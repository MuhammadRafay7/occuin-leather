import Link from "next/link";
import { getOwnerKey, getUser } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { listCategories } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";
import { BRAND } from "@/lib/format";
import { BagDrawer } from "./bag-drawer";
import { HeaderMenu } from "./header-menu";
import { NavLinks } from "./nav-links";

const NAV = [
  { href: "/shop/women", label: "Women" },
  { href: "/shop/men", label: "Men" },
  { href: "/shop/leather/laptop-bags", label: "Laptop bags" },
  { href: "/studio", label: "Design your own" },
];

export async function Header() {
  const [user, ownerKey] = await Promise.all([getUser(), getOwnerKey()]);
  const [{ count }, women, men] = await Promise.all([getCart(ownerKey), listCategories("women"), listCategories("men")]);
  const menus = {
    "/shop/women": women.map((item) => ({ href: categoryPath("women", item.slug), label: item.name })),
    "/shop/men": men.map((item) => ({ href: categoryPath("men", item.slug), label: item.name })),
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 px-2 pt-2 md:px-4 md:pt-3">
      <div className="glass grid h-14 grid-cols-[1fr_auto_1fr] items-center rounded-full px-5 md:px-4">
        <div className="flex items-center">
          <HeaderMenu links={NAV} signedIn={Boolean(user)} isAdmin={user?.role === "admin"} />
          <NavLinks links={NAV} menus={menus} />
        </div>
        <Link href="/" aria-label={`${BRAND.name} home`} className="font-display text-[24px] leading-none tracking-[0.14em] text-invert-bg md:text-[28px]">
          {BRAND.name}
        </Link>
        <nav aria-label="Account" className="flex justify-end gap-5 pr-2 text-[13px] md:gap-6">
          <Link href="/search" className="hidden hover:opacity-60 md:block">Search</Link>
          <Link href={user ? "/account" : "/login"} className="hidden hover:opacity-60 md:block">{user ? "Account" : "Sign in"}</Link>
          <Link href="/wishlist" className="hidden hover:opacity-60 md:block">Saved</Link>
          <BagDrawer count={count} />
        </nav>
      </div>
    </header>
  );
}
