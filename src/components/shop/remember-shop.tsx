"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { readLocal, writeLocal } from "@/lib/local-store";

const KEY = "occuin-shop-view";
const REMEMBERED = ["color", "size", "min", "max", "sort"];

function readSaved(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(readLocal(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function remembered(params: URLSearchParams) {
  const kept = new URLSearchParams();
  params.forEach((value, key) => {
    if (REMEMBERED.includes(key)) kept.append(key, value);
  });
  return kept.toString();
}

export function RememberShop({ path }: { path: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const restored = useRef(false);
  const query = remembered(new URLSearchParams(params.toString()));

  useEffect(() => {
    const saved = readSaved();
    if (!restored.current) {
      restored.current = true;
      const previous = saved[path];
      if (!params.toString() && previous) {
        router.replace(`${path}?${previous}`, { scroll: false });
        return;
      }
    }
    if (query) saved[path] = query;
    else delete saved[path];
    writeLocal(KEY, JSON.stringify(saved));
  }, [path, params, query, router]);

  return null;
}
