import type { Metadata } from "next";
import Image from "next/image";
import { LinkButton, PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "About",
  description: "OCCUIN makes leather bags, laptop bags, wallets and belts, and lets you design your own piece.",
};

export default function AboutPage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle>Fewer things, made properly</PageTitle>
      <div className="grid gap-10 md:grid-cols-12">
        <div className="relative aspect-[4/3] bg-surface md:col-span-7">
          <Image src="/images/grey-satchel.jpg" alt="A grey pebbled leather satchel with twin buckles" fill sizes="(min-width: 768px) 58vw, 100vw" preload className="object-cover" />
        </div>
        <div className="grid content-end justify-items-start gap-5 md:col-span-4 md:col-start-9">
          <p>OCCUIN makes leather goods by hand in Pakistan and ships them worldwide. We care most about what a piece is made of and how it will look after years of use.</p>
          <p>Every product page lists the full composition, so you know exactly which leather and fittings you are buying.</p>
          <p>We describe the hide and the tanning, and we explain how it will change as you use it.</p>
        </div>
      </div>

      <section className="mt-24 grid justify-items-start gap-5 md:grid-cols-[1fr_1fr]">
        <h2 className="font-display text-4xl leading-none md:text-6xl">You can also start from nothing</h2>
        <div className="grid justify-items-start gap-5">
          <p className="max-w-[50ch]">The studio lets you design a leather piece from a blank pattern. You choose the shape, hide, stitching and hardware, and see the price and lead time as you work. We make it to order.</p>
          <LinkButton look="outline" href="/studio">Open the studio</LinkButton>
        </div>
      </section>
    </div>
  );
}
