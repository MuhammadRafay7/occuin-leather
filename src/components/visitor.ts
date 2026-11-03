"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { VISITOR_HINT } from "@/lib/visitor-hint";

export type Visitor = { signedIn: boolean; isAdmin: boolean; count: number };

const GUEST: Visitor = { signedIn: false, isAdmin: false, count: 0 };
const listeners = new Set<() => void>();
let current = GUEST;
let loadedFor: string | null = null;

function publish(next: Visitor) {
  current = next;
  listeners.forEach((listener) => listener());
}

const hint = () => document.cookie.split("; ").find((part) => part.startsWith(`${VISITOR_HINT}=`)) ?? "";

function load() {
  loadedFor = hint();
  fetch("/api/visitor", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((next: Visitor | null) => next && publish(next), () => undefined);
}

export const setVisitorCount = (count: number) => {
  if (count !== current.count) publish({ ...current, count });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useVisitor() {
  const pathname = usePathname();
  useEffect(() => {
    if (loadedFor !== hint()) load();
  }, [pathname]);
  return useSyncExternalStore(subscribe, () => current, () => GUEST);
}
