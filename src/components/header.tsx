import { Heart, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { listCategories } from "@/lib/server/catalog";
import { getContent, getDelivery } from "@/lib/server/content";
import { contactDetails, getSettings, paymentModeOf } from "@/lib/server/settings";
import { categoryPath } from "@/lib/server/shop";
import { BRAND } from "@/lib/format";
import { AccountLink } from "./account-link";
import { AnnouncementBar } from "./announcement-bar";
import { BagDrawer } from "./bag-drawer";
import { BagReminder } from "./bag-reminder";
import { LiquidSurface } from "./glass/liquid-surface";
import { HeaderMenu } from "./header-menu";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";
import { ICON_BUTTON } from "./nav-style";

export async function Header() {
  const [women, men, settings, nav, delivery, contact] = await Promise.all([listCategories("women"), listCategories("men"), getSettings(), getContent("nav"), getDelivery(), contactDetails()]);
  const payment = { whatsapp: paymentModeOf(settings) === "whatsapp", hasNumber: Boolean(contact.whatsapp) };
  const departments = {
    women: women.map((item) => ({ href: categoryPath("women", item.slug), label: item.name })),
    men: men.map((item) => ({ href: categoryPath("men", item.slug), label: item.name })),
  };
  const links = nav.header.map(({ href, label }) => ({ href, label }));
  const menus = Object.fromEntries(
    nav.header.flatMap((item) => {
      if (item.menu === "none") return [];
      return [[item.href, item.menu === "custom" ? item.links : departments[item.menu]]];
    }),
  );

  return (
    <>
      <AnnouncementBar text={settings.announcement} />
      <div className="sticky top-0 z-30 h-0">
        <header className="flex items-start justify-between gap-2 pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))] pt-[max(8px,env(safe-area-inset-top))] md:pl-[max(16px,env(safe-area-inset-left))] md:pr-[max(16px,env(safe-area-inset-right))] md:pt-[max(12px,env(safe-area-inset-top))]">
          <LiquidSurface adaptive className="flex h-14 min-w-0 items-center rounded-full pl-4 pr-4 md:pl-5 min-[1100px]:pr-2">
            <Link href="/" aria-label={`${BRAND.name} home`} className="flex h-11 shrink-0 items-center gap-2 font-display text-[21px] leading-none tracking-[0.16em] text-[var(--ink-strong)] md:text-[23px]">
              <LogoMark className="size-[26px] shrink-0" />
              {BRAND.name}
            </Link>
            <span aria-hidden className="ml-5 mr-2 hidden h-5 w-px bg-[var(--rule)] min-[1100px]:block" />
            <NavLinks links={links} menus={menus} />
          </LiquidSurface>
          <LiquidSurface adaptive className="flex h-14 shrink-0 items-center gap-0.5 rounded-full p-1.5">
            <nav aria-label="Account" className="contents">
              <Link href="/search" aria-label="Search" title="Search" className={`${ICON_BUTTON} max-[379px]:hidden`}>
                <MagnifyingGlass size={19} weight="light" />
              </Link>
              <Link href="/wishlist" aria-label="Saved items" title="Saved items" className={`${ICON_BUTTON} hidden md:grid`}>
                <Heart size={19} weight="light" />
              </Link>
              <AccountLink className={`${ICON_BUTTON} hidden md:grid`} />
              <BagDrawer freeShippingCents={settings.freeShippingCents} delivery={delivery} payment={payment} />
            </nav>
            <HeaderMenu links={links} moreLinks={nav.mobileLinks} />
          </LiquidSurface>
        </header>
      </div>
      <BagReminder />
    </>
  );
}
