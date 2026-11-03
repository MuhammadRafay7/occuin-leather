"use client";

import Link from "next/link";
import { ReviewForm } from "./review-form";
import { useProductVisitor } from "./use-product-visitor";

export function ReviewGate({ productId, slug }: { productId: string; slug: string }) {
  const visitor = useProductVisitor(productId);
  if (!visitor) return null;
  if (visitor.review === "post" || visitor.review === "update") return <ReviewForm productId={productId} hasReview={visitor.review === "update"} />;
  if (visitor.review === "buyers-only") return <p className="text-[13px] text-muted">Only customers who bought this piece can review it.</p>;
  return (
    <p className="text-[13px] text-muted">
      <Link href={`/login?next=${encodeURIComponent(`/product/${slug}`)}`} className="text-fg underline underline-offset-4 hover:opacity-60">Sign in</Link> to review a piece you bought.
    </p>
  );
}
