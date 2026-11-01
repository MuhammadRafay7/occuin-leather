import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Section, Sections } from "@/components/prose";
import { LinkButton, PageTitle } from "@/components/ui";
import { MAKING_TIME, deliveryEstimate } from "@/lib/format";
import { jsonLd, organizationData, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/about");

export default function AboutPage() {
  return (
    <div className="px-page pt-header">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationData())} />
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

      <div className="mt-24">
        <Sections>
          <Section title="What is OCCUIN?">
            <p>OCCUIN is a leather goods brand. It makes leather bags, laptop bags, wallets and belts for women and men. Every piece is made to order in Pakistan and shipped worldwide.</p>
          </Section>
          <Section title="What does OCCUIN make?">
            <p>The range covers <Link href="/shop/leather/laptop-bags">laptop bags and briefcases</Link>, <Link href="/shop/leather/totes">totes</Link>, <Link href="/shop/leather/top-handle">top handle bags</Link>, <Link href="/shop/leather/crossbody">crossbody bags</Link>, <Link href="/shop/leather/travel">travel bags</Link>, <Link href="/shop/leather/wallets">wallets and card cases</Link> and <Link href="/shop/leather/belts">belts</Link>. You can also browse by <Link href="/shop/women">women</Link> or <Link href="/shop/men">men</Link>.</p>
          </Section>
          <Section title="How do custom orders work?">
            <p>There are two ways to order a custom leather bag.</p>
            <ul>
              <li>In the <Link href="/studio">studio</Link>, you start from one of our forms and change the size, leather, stitching and hardware in live 3D. You can add a monogram of up to four letters. You see the price as you go and order it directly.</li>
              <li>In the <Link href="/studio/create">designer</Link>, you draw your own piece from scratch and see an estimate. You send it to our workshop, we review it and email you a final price, and work starts after you accept it.</li>
            </ul>
          </Section>
          <Section title="How long does an order take?">
            <p>We take {MAKING_TIME} to make and pack a piece. With tracked shipping an order {deliveryEstimate("standard").toLowerCase()}, and by express courier it {deliveryEstimate("express").toLowerCase()}. A piece designed from scratch usually takes longer, and we confirm the timing with your final price. <Link href="/shipping-returns">Read about shipping and returns</Link>.</p>
          </Section>
        </Sections>
      </div>
    </div>
  );
}
