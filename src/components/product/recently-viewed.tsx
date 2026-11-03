"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";

const KEY = "occuin.recent.v1";
const KEEP = 12;
const SHOW = 6;

type Seen = { slug: string; name: string; image: string };

const isSeen = (value: unknown): value is Seen =>
  typeof value === "object" && value !== null && ["slug", "name", "image"].every((field) => typeof (value as Record<string, unknown>)[field] === "string");

function parse(raw: string): Seen[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isSeen).filter((item) => item.image.startsWith("/")) : [];
  } catch {
    return [];
  }
}

function read() {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function RecentlyViewed({ current }: { current: Seen }) {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const items = useMemo(() => parse(raw).filter((item) => item.slug !== current.slug).slice(0, SHOW), [raw, current.slug]);

  useEffect(() => {
    try {
      const next = [current, ...parse(localStorage.getItem(KEY) ?? "[]").filter((item) => item.slug !== current.slug)].slice(0, KEEP);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, [current]);

  if (!items.length) return null;

  return (
    <section aria-labelledby="recently-viewed" className="mt-14">
      <h2 id="recently-viewed" className="mb-4 font-display text-xl">Recently viewed</h2>
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
        {items.map((item) => (
          <li key={item.slug} className="w-[38%] shrink-0 snap-start min-[480px]:w-[28%] md:w-auto">
            <Link href={`/product/${item.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] bg-surface">
                <Image src={item.image} alt="" fill sizes="(min-width: 768px) 200px, 38vw" unoptimized={item.image.startsWith("/api/")} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
              </div>
              <p className="mt-2 text-[13px] leading-snug">{item.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
