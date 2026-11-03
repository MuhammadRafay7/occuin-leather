"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncBagCount } from "@/components/bag-drawer";
import type { SuggestedCard } from "@/lib/server/suggestions";
import { PairsWell } from "./pairs-well";

export function BagCountSync({ count }: { count: number }) {
  useEffect(() => syncBagCount(count), [count]);
  return null;
}

export function BagPagePairs({ suggestions }: { suggestions: SuggestedCard[] }) {
  const router = useRouter();
  return (
    <PairsWell
      size="page"
      suggestions={suggestions}
      onAdded={({ bag }) => {
        syncBagCount(bag.count);
        router.refresh();
      }}
    />
  );
}
