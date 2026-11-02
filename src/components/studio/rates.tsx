"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Delivery } from "@/lib/format";
import type { StudioPricing } from "@/lib/studio/pricing";

export type StudioRates = { pricing: StudioPricing; delivery: Delivery };

const Rates = createContext<StudioRates | null>(null);

export function StudioRatesProvider({ rates, children }: { rates: StudioRates; children: ReactNode }) {
  return <Rates value={rates}>{children}</Rates>;
}

export function useStudioRates() {
  const rates = useContext(Rates);
  if (!rates) throw new Error("useStudioRates needs a StudioRatesProvider");
  return rates;
}
