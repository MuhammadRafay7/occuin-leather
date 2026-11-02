import Link from "next/link";
import type { CSSProperties } from "react";
import { whatsappChatUrl } from "@/lib/bespoke/whatsapp";
import { BRAND } from "@/lib/format";
import { getContent } from "@/lib/server/content";
import { contactDetails } from "@/lib/server/settings";
import { LogoMark } from "./logo";
import { CookieNotice } from "./cookie-notice";
import { NewsletterForm } from "./newsletter-form";

export async function Footer() {
  const [contact, { footer }] = await Promise.all([contactDetails(), getContent("nav")]);
  return (
    <footer className="px-page mt-16 border-t border-line py-14 md:mt-24">
      <div style={{ "--footer-columns": footer.columns.length } as CSSProperties} className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-10 md:[grid-template-columns:2fr_repeat(var(--footer-columns),1fr)]">
        <div className="col-span-2 grid content-start gap-8 md:col-span-1">
          <p className="flex items-center gap-2 font-display text-3xl tracking-[0.16em]"><LogoMark className="size-9 shrink-0" />{BRAND.name}</p>
          <NewsletterForm />
          <p className="grid gap-1 text-sm">
            <a href={`mailto:${contact.email}`} className="flex min-h-11 w-fit items-center break-all hover:opacity-60 lg:min-h-0">{contact.email}</a>
            {contact.whatsapp ? <a href={whatsappChatUrl(contact.whatsapp, "")} target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-fit items-center hover:opacity-60 lg:min-h-0">Chat on WhatsApp</a> : null}
          </p>
        </div>
        {footer.columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="grid content-start text-sm lg:gap-2">
            <p className="text-muted lg:mb-1">{column.title}</p>
            {column.links.map(({ label, href }) => (
              <Link key={href} href={href} className="flex min-h-11 items-center hover:opacity-60 lg:block lg:min-h-0">{label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <p className="mt-14 text-xs text-muted">© {new Date().getFullYear()} {BRAND.name}.{footer.copyright ? ` ${footer.copyright}` : ""}</p>
      <p aria-hidden="true" className="-mx-4 -mb-14 mt-8 select-none overflow-hidden whitespace-nowrap text-center font-display text-[22.5vw] leading-[0.82] text-invert-bg md:-mx-8">{BRAND.name}</p>
      <CookieNotice />
    </footer>
  );
}
