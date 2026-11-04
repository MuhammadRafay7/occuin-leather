"use client";

import Link from "next/link";
import { Bone } from "@/components/skeleton";
import { ReviewForm } from "./review-form";
import { useProductVisitor } from "./use-product-visitor";

export function ReviewGate({ productId, slug }: { productId: string; slug: string }) {
  const visitor = useProductVisitor(productId);
  if (!visitor) {
    return (
      <div role="status" aria-label="Loading reviews" className="grid gap-2">
        <Bone className="h-3.5 w-64 max-w-full" />
        <Bone className="h-3.5 w-40" />
      </div>
    );
  }
  if (visitor.review === "post" || visitor.review === "update") return <ReviewForm productId={productId} hasReview={visitor.review === "update"} />;
  if (visitor.review === "buyers-only") return <p className="text-[13px] text-muted">Only customers who bought this piece can review it.</p>;
  return (
    <p className="text-[13px] text-muted">
      <Link href={`/login?next=${encodeURIComponent(`/product/${slug}`)}`} className="text-fg underline underline-offset-4 hover:opacity-60">Sign in</Link> to review a piece you bought.
    </p>
  );
}
