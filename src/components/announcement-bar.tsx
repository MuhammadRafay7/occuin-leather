"use client";

import { usePathname } from "next/navigation";

export function AnnouncementBar({ text }: { text: string }) {
  const pathname = usePathname();
  if (!text || pathname.startsWith("/admin")) return null;
  return <p className="bg-invert-bg px-4 py-1.5 text-center text-xs leading-4 text-invert-fg">{text}</p>;
}
