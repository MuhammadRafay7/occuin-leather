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
import { HeaderMenu } from "./header-menu";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";

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
        <header className="pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))] pt-[max(8px,env(safe-area-inset-top))] md:pl-[max(16px,env(safe-area-inset-left))] md:pr-[max(16px,env(safe-area-inset-right))] md:pt-[max(12px,env(safe-area-inset-top))]">
          <div className="glass grid h-14 grid-cols-[1fr_auto_1fr] items-center rounded-full px-5 md:px-4">
            <div className="flex items-center">
              <HeaderMenu links={links} moreLinks={nav.mobileLinks} />
              <NavLinks links={links} menus={menus} />
            </div>
            <Link href="/" aria-label={`${BRAND.name} home`} className="flex items-center gap-1.5 flex h-11 items-center font-display text-[24px] leading-none tracking-[0.14em] text-invert-bg md:text-[28px]">
              <LogoMark className="size-8 shrink-0" />
              {BRAND.name}
            </Link>
            <nav aria-label="Account" className="flex items-center justify-end gap-5 pr-2 text-[13px] md:gap-6">
              <Link href="/search" className="hidden h-11 items-center hover:opacity-60 md:flex">Search</Link>
              <AccountLink className="hidden h-11 items-center hover:opacity-60 md:flex" />
              <Link href="/wishlist" className="hidden h-11 items-center hover:opacity-60 md:flex">Saved</Link>
              <BagDrawer freeShippingCents={settings.freeShippingCents} delivery={delivery} payment={payment} />
            </nav>
          </div>
        </header>
      </div>
      <BagReminder />
    </>
  );
}
