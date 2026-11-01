import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui";
import { FREE_SHIPPING_CENTS, MAKING_NOTE, SHIPPING_METHODS, money } from "@/lib/format";

export const metadata: Metadata = {
  title: "Questions",
  description: "Answers about orders, delivery, returns, sizing and the design studio.",
};

const QUESTIONS: { question: string; answer: ReactNode }[] = [
  {
    question: "How long does delivery take?",
    answer: `${MAKING_NOTE} ${SHIPPING_METHODS.standard.label} costs ${money(SHIPPING_METHODS.standard.cents)}, and it is free over ${money(FREE_SHIPPING_CENTS)}. ${SHIPPING_METHODS.express.label} costs ${money(SHIPPING_METHODS.express.cents)}.`,
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
    question: "How do I pay?",
    answer: "We take card payments through Stripe. We never see or store your full card number.",
  },
];

export default function FaqPage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle>Questions</PageTitle>
      <div className="max-w-3xl">
        {QUESTIONS.map((item) => (
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
