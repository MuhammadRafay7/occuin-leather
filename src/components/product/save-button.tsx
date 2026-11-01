"use client";

import { Heart } from "@phosphor-icons/react";
import { useOptimistic, useState, useTransition } from "react";
import { toggleWishlist } from "@/lib/actions/wishlist";

type Props = { productId: string; productName: string; saved: boolean; removeLabel?: string };

export function SaveButton({ productId, productName, saved, removeLabel = "Saved" }: Props) {
  const [shown, setShown] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    setError(null);
    start(async () => {
      setShown(!shown);
      const result = await toggleWishlist(productId);
      if ("error" in result && result.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={shown}
        aria-label={shown ? `Remove ${productName} from saved items` : `Save ${productName}`}
        className="inline-flex h-8 items-center gap-1.5 text-[12px] hover:opacity-60"
      >
        <Heart size={15} weight={shown ? "fill" : "regular"} aria-hidden />
        {shown ? removeLabel : "Save"}
      </button>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
