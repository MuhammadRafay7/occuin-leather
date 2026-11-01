import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui";
import { FREE_SHIPPING_CENTS, MAKING_NOTE, SHIPPING_METHODS, deliveryEstimate, money } from "@/lib/format";
import { faqData, jsonLd, pageMeta } from "@/lib/seo";
import { listProducts } from "@/lib/server/catalog";
import { FINISHES } from "@/lib/studio/spec";

export const metadata: Metadata = pageMeta("/faq");

type Question = { question: string; answer: ReactNode };

const FINISH_NAMES = Object.values(FINISHES).map((finish) => finish.name.toLowerCase()).join(", ");

const QUESTIONS: Question[] = [
  {
    question: "What is OCCUIN?",
    answer: "OCCUIN is a leather goods brand. It makes leather bags, laptop bags, wallets and belts for women and men, made to order in Pakistan and shipped worldwide.",
  },
  {
    question: "Where are OCCUIN pieces made?",
    answer: "In Pakistan. Every piece is made to order and ships from Pakistan.",
  },
  {
    question: "How do custom orders work?",
    answer: <>In the <Link href="/studio">studio</Link> you change the size, leather, stitching and hardware of a form in live 3D, add a monogram of up to four letters, see the price and order it directly. In the <Link href="/studio/create">designer</Link> you draw a piece from scratch and send it to our workshop. We review it, email you a final price, and work starts after you accept it. You pay nothing when you send the design.</>,
  },
  {
    question: "What leather do you use?",
    answer: <>Every product page names the leather and fittings for that piece. In the <Link href="/studio">studio</Link> you can choose from {FINISH_NAMES}.</>,
  },
  {
    question: "How long does delivery take?",
    answer: `${MAKING_NOTE} With tracked shipping an order ${deliveryEstimate("standard").toLowerCase()}, and by express courier it ${deliveryEstimate("express").toLowerCase()}. ${SHIPPING_METHODS.standard.label} costs ${money(SHIPPING_METHODS.standard.cents)}, and it is free over ${money(FREE_SHIPPING_CENTS)}. ${SHIPPING_METHODS.express.label} costs ${money(SHIPPING_METHODS.express.cents)}.`,
  },
  {
    question: "Do I need an account to order?",
    answer: "No. You can check out as a guest. With an account, your orders, saved items and designs stay in one place.",
  },
  {
    question: "How do I track my order?",
    answer: <>Use the <Link href="/track">tracking page</Link> with your order number and the email you ordered with.</>,
  },
  {
    question: "How do I return something?",
    answer: <>Every piece is made to order, so we only take back pieces that arrive faulty or differ from your order. <Link href="/shipping-returns">Read the policy</Link> or <Link href="/contact">write to us</Link> with your order number.</>,
  },
  {
    question: "How do I find my size?",
    answer: <>The <Link href="/size-guide">size guide</Link> has belt sizes and laptop fit. If you are between sizes, take the larger.</>,
  },
  {
    question: "What is the design studio?",
    answer: <>The <Link href="/studio">studio</Link> lets you design a leather piece from a blank pattern. You see the price and lead time as you work, and we make it to order.</>,
  },
  {
    question: "Can I return a piece I designed?",
    answer: "Studio pieces are made for you, so they can only be returned if they arrive faulty or differ from your design.",
  },
  {
    question: "How should I look after leather?",
    answer: <>Keep it dry, away from direct heat, and condition it twice a year. The <Link href="/care">care guide</Link> covers each material.</>,
  },
  {
    question: "Can I use a promo code on a bespoke piece?",
    answer: "No. Promo codes apply to ready-made and studio pieces. Bespoke deposits and balances are charged at the price we quote you.",
  },
  {
    question: "How do I pay?",
    answer: "We take card payments through Stripe. We never see or store your full card number.",
  },
];

export default async function FaqPage() {
  const prices = (await listProducts()).map((card) => card.priceCents);
  const questions: Question[] = [
    ...QUESTIONS,
    {
      question: "How much does an OCCUIN piece cost?",
      answer: `Prices run from ${money(Math.min(...prices))} to ${money(Math.max(...prices))} in US dollars, before shipping and any import duties. Pieces you design yourself are priced by their size and materials.`,
    },
  ];
  return (
    <div className="px-page pt-header">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqData(questions))} />
      <PageTitle>Questions</PageTitle>
      <div className="max-w-3xl">
        {questions.map((item) => (
          <details key={item.question} className="group border-t border-line last:border-b">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-3 [&::-webkit-details-marker]:hidden">
              {item.question}
              <span aria-hidden className="text-lg leading-none group-open:hidden">+</span>
              <span aria-hidden className="hidden text-lg leading-none group-open:inline">-</span>
            </summary>
            <p className="max-w-[65ch] pb-5 text-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
